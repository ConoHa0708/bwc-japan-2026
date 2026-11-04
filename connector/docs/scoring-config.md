# 配点としきい値の設定

## リポジトリの値は見本
`src/scoring.ts` の各観点の `points` と、`SAMPLE_CONFIG` の黒とグレーのしきい値は、公開用の見本です。
公開中のコネクターは、Cloudflare の Secret `SCORING_CONFIG` があれば、その値で採点します。
`SCORING_CONFIG` がない、または読めない場合は見本の値で採点します。

運用の配点を公開しないのは、配点が読めると、点数を避けるように偽のページを作れてしまうためです。
観点の一覧は Claude に渡す作法に含まれるため公開されます。何点で黒になるかは公開しません。

この仕組みを入れた時点（PR #6）までの履歴にある配点としきい値は、期間中に実際に使っていた値です。

## 形式
```json
{
  "points": { "org_claim": 10, "login_mismatch_verified": 40 },
  "black_min": 60,
  "gray_min": 30
}
```
- `points` に書かない観点は、見本の配点を使います。
- `gray_min` は `black_min` より小さくします。満たさないときは見本の値で採点します。
- 合計の上限（100点）と、偽物の証拠がないときに黒の手前で止める決まりは、設定では変えません。

## 設定のしかた
```bash
npx wrangler secret put SCORING_CONFIG
```
手元の `wrangler dev` では `connector/.dev.vars` に `SCORING_CONFIG='{...}'` と書きます（`.gitignore` で除外済み）。
