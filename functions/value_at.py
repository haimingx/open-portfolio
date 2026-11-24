# Value of one wallet on one chain at each of several moments, in USD, as the page counts them. `times` is a comma-separated
# list of RFC 3339 UTC moments, or 'latest'. Each moment reads the holdings of the last block at or before it, so a day's
# trades are counted from the moment they happened, and one call covers a whole day of a chart.
def _(address, chain, times):
    from blockdb import NormalTable, StateTable, TimeTable
    from leafage import EVM

    address = address.lower()
    moments = [t for t in times.split(',')] if times != 'latest' else ['latest']
    blocks = NormalTable('chain.block.' + chain)
    at = []
    for moment in moments:
        row = blocks.find(order_by='block_timestamp DESC', limit=1)[0] if moment == 'latest' else \
            blocks.find(filters="block_timestamp <= '%s'" % moment, order_by='block_timestamp DESC', limit=1)[0]
        at.append((row['block_id'], int(row['block_height']), utc(row['block_timestamp'])))

    # Tokens: the native coin and every listed token, as the page reads them.
    listed = set()
    for row in NormalTable('cex.cex_listed_token').find(filters="chain_id = '%s'" % chain, limit=10000):
        if row.get('token_id'):
            listed.add(row['token_id'].lower())
    for token_id in EXTRA_TOKENS.get(chain, []):
        listed.add(token_id)
    listed.discard(NATIVE)
    candidates = sorted(listed)
    if times != 'latest':
        # Reading every listed token at an old block is slow on some chains (BSC takes about 3 ms a call). A token held then
        # is either still held or was transferred since, so only those are read at the old blocks.
        since = set(balances(EVM(chain), candidates, address))
        transfers = NormalTable('token.token_transfer.' + chain)
        for column in ('from_addr', 'to_addr'):
            for row in transfers.find(filters="%s = '%s' AND block_timestamp > '%s'" % (column, address, moments[0]), limit=10000):
                since.add(row['token_id'].lower())
        candidates = sorted(since & listed)

    # Positions: each pool the wallet ever touched, parsed again at each block by the platform's own parser and valued by
    # its own payload functions, so a past moment is counted the way balance.pool_balance counts today.
    raws = NormalTable('balance.pool_raw_balance.' + chain).find(filters="owner = '%s'" % address, limit=1000)
    values = []
    skipped = 0
    for block_id, height, stamp in at:
        evm = EVM(chain, block_id)
        held = balances(evm, candidates, address)
        held[NATIVE] = evm.get_balance(address)
        ids = sorted(held)
        decimals = {NATIVE: 18}
        others = [token_id for token_id in ids if token_id != NATIVE]
        for token_id, row in zip(others, StateTable('token.token.' + chain).get_many(others) if others else []):
            if row and row.get('decimals') is not None:
                decimals[token_id] = int(row['decimals'])
        value = 0.0
        for token_id, row in zip(ids, TimeTable('price.price.' + chain, stamp[:16] + ':00Z').get_many(ids)):
            if row and row.get('value') and token_id in decimals and held[token_id]:
                value += held[token_id] / 10 ** decimals[token_id] * row['value']
        for raw in raws:
            # The last snapshot is empty and older than the moment: the position was already closed then.
            if not raw.get('raw_positions') and utc(raw['block_timestamp']) <= stamp:
                continue
            try:
                value += pool_value(chain, raw['function_id'], raw['pool_id'], address, block_id, height, stamp)
            except Exception as error:
                # As in the platform's own refresh, a parser's own bug skips that pool; platform failures fail the call so it is retried.
                if is_system_error(f'{type(error).__name__}: {error}'):
                    raise
                skipped += 1
        values.append({'time': stamp, 'value': round(value, 2)})
    return {'block': at[-1][1], 'points': values, 'skipped': skipped}


def balances(evm, token_ids, owner):
    from leafage import Call

    raws = evm.call_many([Call(token_id, 'balanceOf(address)(uint256)', [owner]) for token_id in token_ids], raise_on_error=False)
    held = {}
    for token_id, raw in zip(token_ids, raws):
        if raw:
            held[token_id] = int(raw)
    return held


def pool_value(chain, function_id, pool_id, owner, block_id, height, stamp):
    from blockx import function

    parsed = function.call(function_id, chain, block_id, {'id': pool_id}, owner)
    if not parsed or not parsed.get('raw_positions'):
        return 0.0
    parsed['function_id'] = function_id
    parsed = function.call('balance.payload.normalize_raw_balance', parsed)
    if not parsed.get('raw_positions'):
        return 0.0
    parsed['function_id'] = function_id
    parsed['block_id'] = block_id
    parsed['block_height'] = height
    parsed['block_timestamp'] = stamp
    return function.call('balance.payload.raw_balance_to_balance', chain, parsed)['usd_value']


# Same rule as balance.etl.pool_raw_balance_to_pool_balance.
def is_system_error(text):
    for keyword in SYSTEM_ERROR_KEYWORDS:
        if keyword in text:
            return True
    return text.startswith('FunctionInvokeError: [') and not text.startswith('FunctionInvokeError: [FAILURE_CODE_')


def utc(value):
    return str(value).replace(' ', 'T').replace('+00:00', 'Z')


SYSTEM_ERROR_KEYWORDS = (
    'ContractCallServiceError',
    'BlockNotFoundError',
    'RpcError',
    '[FAILURE_CODE_TIMED_OUT]',
    '[FAILURE_CODE_IO_PROXY_FAILED]',
    '[FAILURE_CODE_EXECUTOR_LOST]',
    '[FAILURE_CODE_EXECUTOR_CAPACITY_EXHAUSTED]',
)
NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
# Filled from data/tokens.extra.json at deploy time: tokens the page counts that no exchange lists.
EXTRA_TOKENS = {}
