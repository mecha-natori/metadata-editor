# AGENTS.md

## Project Overview

- Tauri v2 のPC向けデスクトップアプリケーション
- フロントエンド: TypeScript + React v19 + React Router v8 (Data mode)

## Commands

- Install deps: `pnpm install`
- Lint CSS: `pnpm lint:lint:style`
- Lint TypeScript: `pnpm lint:lint:js`
- Type check: `pnpm typecheck`
- Run dev app (require `node_modules/.bin` in PATH): `tauri dev`
- Build app for production (require `node_modules/.bin` in PATH): `tauri build`
- Build app for debug (require `node_modules/.bin` in PATH):
  `tauri build --debug`

## Code Style

### Common

- エンコーディング: UTF-8 (BOM無し)
- 改行: LFのみ
  - ファイル末尾の改行: 常にあり
- 行末の空白: 常に除去
- 行幅: 80文字以下

### JavaScript/TypeScript

- ファイル名: kebab-case (`some-module.ts`・`some-component.tsx`)
- コンポーネント名: PascalCase (`SomeComponent`)
- コンポーネント形式: 関数コンポーネント、function宣言
- コンポーネントPropsの型: インターフェース
  - コンポーネントProps名: PascalCase、コンポーネント名 + `Props` (`SomeComponentProps`)
- コンポーネントのエクスポート方法: 名前付きエクスポート
- 状態管理: `boolean`なら`useSwitchState`を優先
- インデント: スペース4つ
- クォーテーション: シングルクォート、必要な場合のみバッククォート
  - JSX属性: 常にダブルクォート
- import拡張子:
  - アプリコード: import元がJS/TSであれば省略、JSON・CSSなど外部ファイルは付与。
  - ツール・コンフィグ: 常に付与
- 同一import先からの値importと型import: 常に分ける
- import順: import元をASCII順で整列、importアイテムもASCII順で整列
- 制御構文の中括弧: 常に書く
- 行末のセミコロン: 常に書く
- 末尾のコンマ: 常に省く
- `use strict`: 常に省く

### CSS

- インデント: スペース4つ
- クォーテーション: シングルクォート
- プロパティ順: ASCII順
- 宣言ブロック内: 変数、カスタムプロパティ、宣言、at-rule、ルールの順
- 色: OkLCH (`oklch(42% 0.42 42deg / 0.42)`)
- 疑似要素: 常に二重コロン
- ゼロの単位: 常に除去

### Markdown

- インデント: スペース2つ
- h1: 一つのみ
- ulの文字: `-`
- olの文字: `1.`、`2.`、`3.`、...
- 末尾リンク参照名: 全て小文字
- brの方法: 末尾バックスラッシュ

## Git

- コミットメッセージ: 日本語
  - 接頭辞: `chore:`, `ci:`, `docs:`, `feature:`, `fix:`, `refactor:`
    - 複数組み合わせる場合の例: `ci,fix:`
- ブランチ名: `feature/xxx` (任意のフィーチャ名)・`issue/xxx` (issue番号)
