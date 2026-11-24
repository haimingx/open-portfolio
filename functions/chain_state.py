# One chain's balance and prices at the latest block: which tokens to count, what the wallet holds of each, and what each is
# worth. Returns only the tokens with a balance, so the site never receives a list of zeros.
def _(address, chain):
    from blockdb import NormalTable, TimeTable
    from leafage import EVM, Call

    address = address.lower()
    listed = set()
    for row in NormalTable('cex.cex_listed_token').find(filters="chain_id = '%s'" % chain, limit=10000):
        if row.get('token_id'):
            listed.add(row['token_id'].lower())
    for token_id in EXTRA_TOKENS.get(chain, []):
        listed.add(token_id)
    listed.discard(NATIVE)

    evm = EVM(chain)
    ids = sorted(listed)
    held = {}
    for token_id, raw in zip(ids, evm.call_many([Call(t, 'balanceOf(address)(uint256)', [address]) for t in ids], raise_on_error=False)):
        if raw:
            held[token_id] = str(int(raw))
    native = str(evm.get_balance(address))

    prices = {}
    wanted = [NATIVE] + list(held)
    for token_id, row in zip(wanted, TimeTable('price.price.' + chain).get_many(wanted)):
        if row and row.get('value') is not None:
            prices[token_id] = row['value']
    return {'native': native, 'tokens': held, 'prices': prices}


NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
# Filled from data/tokens.extra.json at deploy time: tokens the page counts that no exchange lists.
EXTRA_TOKENS = {}
