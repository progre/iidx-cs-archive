# build_hashes

ビルドの移行で出力が変わっていないことを確かめるため、
ISO と中間物のハッシュ (SHA-256) を記録し、記録との差分を一覧にする。
ハッシュの記録は、正しいと確かめた ISO と中間ファイルから作る。

記録は素材から作り直せるので、`build/hashes/` に置き、git で管理しない。
記録を作ったコードのコミットは `cc4eb1e765a906726aaf1352cd9a6271806f3b97` である。
記録を失ったら、このコミットをチェックアウトして全曲構成の ISO を作り、
「記録の作り直し」を実行する。

- `iso_files.json`: ISO 内のファイルの大きさ・ハッシュ。
- `intermediates.json`: 中間物のグループごとの置き場・対象の正規表現・大きさ・ハッシュ。

## 記録の対象

ISO は日時の欄が実行ごとに変わりうるので、ISO 全体ではなくファイルの単位で比べる。
PVD とディレクトリーレコードは対象にしない。

- `files`: ISO9660 のディレクトリーに載るファイル。
- `extents`: ディレクトリーに載らず、絶対 LBA に置かれる資産。
  - キーは次の4種である。
    - `abc/<ABC 表の行>`
    - `data1/title_card/<DATA1 の行>`
    - `data1/overlay/<DATA1 の行>`
    - `data1/image_set/<DATA1 の行>`
  - 検査は、記録に残した LBA の位置からデータを読んで比べる。
  - 資産の置き場所が変わると、差分が出る。
- 中間物のグループは次の4つである。
  - `sound_bundles`・`title_cards`・`overlays`・`csa_elf`
  - どのグループも、`build/intermediate/` の下を探す。
    `groups.ts` の正規表現に合うファイルだけを記録する。
- 譜面は中間ファイルに暗号化して書かないので、グループにしない。ISO の照合で確かめる。
- 曲の行と manifest はファイルに書かないので、記録に加えない。
- `discs/<世代>/` の `chart_lz.bin`・`elf.bin`・`video_copy/` は、記録に加えない。ISO の照合で確かめる。

## 検査

差分のファイルを `changed`・`missing`・`added` とパスで一覧にし、末尾に件数を出す。
0件なら終了コード 0、1件以上なら 1 で終わる。
全曲構成の ISO (約 32GB) は 1 分ほどかかる。

```powershell
# ISO
deno run --allow-read=. `
  packages/utils/build_hashes/main.ts `
  check --iso=build/iidx-cs-archive.iso

# 中間物
deno run --allow-read=. `
  packages/utils/build_hashes/main.ts `
  check-intermediates
```

中間物の検査は、`table/groups.ts` の置き場(`build/intermediate/`)を読む。
記録に残った置き場は使わない。
グループの置き場を差し替えるには、`--root=<グループ>=<フォルダー>` を指定する。

## 記録の作り直し

記録は、`packages/app/main.ts` で ISO を作った後に作り直す。
`main.ts` には `--write-plan` を付けて、配置計画のファイルを書かせる。
`--plan` には、そのファイルを指定する。

```powershell
deno run --allow-read=. --allow-write=build/hashes `
  packages/utils/build_hashes/main.ts `
  record --iso=build/iidx-cs-archive.iso `
  --plan=build/intermediate/iso/individual_asset_plan.tsv
deno run --allow-read=. --allow-write=build/hashes `
  packages/utils/build_hashes/main.ts `
  record-intermediates
```
