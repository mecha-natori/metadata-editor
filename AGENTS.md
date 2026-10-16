# AGENTS.md

## Project Overview

- Tauri v2 のPC向けデスクトップアプリケーション
- フロントエンド: TypeScript + React v19 + React Router v8 (Data mode)

## Commands

- Install deps: `pnpm install`
- Run dev app (require `node_modules/.bin` in PATH): `tauri dev`
- Lint CSS: `pnpm lint:lint:style`
- Lint TypeScript: `pnpm lint:lint:js`
- Type check: `pnpm typecheck`
- Build app for production (require `node_modules/.bin` in PATH): `tauri build`
- Build app for debug (require `node_modules/.bin` in PATH):
  `tauri build --debug`

## Code Style

- コンポーネントのファイル名: kebab-case (`some-component.tsx`)
- コンポーネント名: PascalCase (`SomeComponent`)
- コンポーネント形式: 関数コンポーネント
- コンポーネントPropsの型: インターフェース
  - コンポーネントProps名: PascalCase、コンポーネント名 + `Props` (`SomeComponentProps`)
- 状態管理: `boolean`なら`useSwitchState`を優先
- 制御構文の中括弧: 常に書く
- 行末のセミコロン: 常に書く
- 末尾のコンマ: 常に省く
- 同一import先からの値importと型import: 常に分ける

## Git

- コミットメッセージ: 日本語
  - 接頭辞: `chore:`, `ci:`, `docs:`, `feature:`, `fix:`, `refactor:`
    - 複数組み合わせる場合の例: `ci,fix:`
- ブランチ名: `feature/xxx` (任意のフィーチャ名)・`issue/xxx` (issue番号)
