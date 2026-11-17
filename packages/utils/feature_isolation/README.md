# feature_isolation

`packages/features/` 配下のパッケージが、他の features パッケージを参照していないかを検査する。
あわせて、deno.json が `features` の2階層目だけにあるかを検査する。

```sh
deno run --allow-read=. packages/utils/feature_isolation/main.ts
```

- 違反があれば、ファイル・行・参照先（deno.json の場合はそのパス）を標準エラーへ出して、終了コード1で終わる。
- 違反が無ければ、検査したパッケージ数を標準出力へ出す。

## 検査する参照

- `@csa/` の指定子が、自分以外の features パッケージの名前を指す参照である。
- 相対パスが、自パッケージのフォルダーの外へ出る参照である。
- 対象は静的 import、`export ... from`、文字列リテラルの動的 import である。
- コメント内の記述は対象に含めない。

## 検査する配置

- `features/<グループ>/<パッケージ>/deno.json` の形でない deno.json を、違反として報告する。
  ワークスペースのメンバーは `features/*/*` だけなので、3階層目以降のパッケージは気付かないうちにメンバーから外れる。

## 検査しない参照

- `app` / `utils` から `features` への向きと、`features` から `core` への向きは検査しない。
- `deno.json` の `imports` は検査しない。

## core_usage

`core` が外へ出す名前を、2つ以上の features のパッケージが使っているかを検査する。

```sh
deno run --allow-read=. packages/utils/feature_isolation/core_usage/main.ts
```

- 使う features が2つ未満の名前があれば、名前と使用先を標準エラーへ出して、終了コード1で終わる。
- `--list` を付けると、名前ごとの使用先を標準出力へ全件出す。
- features のパッケージは、`@csa/core` から import した名前を使ったものとして数える。
- 別の `core` の型の定義に現れる名前は、その型を使うパッケージも使ったものとして数える。
- `app` と `utils` の参照は数えない。
- `import * as` で `@csa/core` を読むファイルがあれば、検査できないので異常終了する。
