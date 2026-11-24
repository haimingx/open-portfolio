# The tokens each exchange lists, per chain. This is the site's allowlist: the tokens a wallet's total may count. One call
# returns the whole map as pairs, which is all the site reads — the table itself carries eight more columns per row.
def _():
    from blockdb import NormalTable

    # Lists rather than sets: the function runtime hands back plain data only, and a dict of sets comes back empty.
    listed = {}
    for row in NormalTable('cex.cex_listed_token').find(limit=10000):
        chain, token = row.get('chain_id'), row.get('token_id')
        if chain and token:
            if chain not in listed:
                listed[chain] = []
            listed[chain].append(token.lower())
    return {chain: sorted(set(tokens)) for chain, tokens in sorted(listed.items())}
