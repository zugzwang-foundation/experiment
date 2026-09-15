# prod-seed — posting through the real endpoints from one signed-in account

These are the scripts used on 2026-09-15 to seed the production Chess market
with image posts and to run single-account write tests. They call exactly what
the browser composer calls (`/api/uploads/sign` → R2 PUT → `/api/bets/place`,
`/api/bets/sell`) and touch no database directly.

They read the session cookie VALUE from `~/.zz-prod-session` — the value of the
`__Secure-zugzwang_session` cookie, copied from a browser signed in as the test
participant. ⛔ Never commit that file or paste the value into a chat.

    ./post-one.sh <n> <YES|NO> <marketId>        # one image post, image post-<n>.png
    python3 write-tests.py <marketId> <parentCommentId>

Every run stakes real Đ from the account and leaves permanent rows on the live
market. One account can hold only one side per market, so all posts after the
first must be on the same side.
