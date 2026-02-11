import type { ValueOf } from 'type-fest';

const C = 'c';
const CPP = 'cpp';
const CSHARP = 'csharp';
const CLOJURE = 'clojure';
const CSS = 'css';
const DART = 'dart';
const DOCKERFILE = 'docker';
const ELIXIR = 'elixir';
const ERLANG = 'erlang';
const GO = 'go';
const GRAPHQL = 'graphql';
const HASKELL = 'haskell';
const HTML = 'html';
const JAVA = 'java';
const JAVASCRIPT = 'javascript';
const JSON = 'json';
const JSX = 'jsx';
const KOTLIN = 'kotlin';
const LATEX = 'latex';
const MAKEFILE = 'makefile';
const MARKDOWN = 'markdown';
const OCAML = 'ocaml';
const PERL = 'perl';
const PHP = 'php';
const PLAINTEXT = 'plaintext';
const PYTHON = 'python';
const R = 'r';
const RACKET = 'racket';
const RUBY = 'ruby';
const RUST = 'rust';
const SCALA = 'scala';
const SCHEME = 'scheme';
const SHELL = 'shellscript';
const SPARQL = 'sparql';
const SQL = 'sql';
const SYSTEM_VERILOG = 'system-verilog';
const TERRAFORM = 'terraform';
const TOML = 'toml';
const TSX = 'tsx';
const TYPESCRIPT = 'typescript';
const VUE = 'vue';
const WEBASSEMBLY = 'wasm';
const XML = 'xml';
const YAML = 'yaml';

export const codeBlockLanguages = {
  C,
  CPP,
  CSHARP,
  CLOJURE,
  CSS,
  DART,
  DOCKERFILE,
  ELIXIR,
  ERLANG,
  GO,
  GRAPHQL,
  HASKELL,
  HTML,
  JAVA,
  JAVASCRIPT,
  JSON,
  JSX,
  KOTLIN,
  LATEX,
  MAKEFILE,
  MARKDOWN,
  OCAML,
  PERL,
  PHP,
  PLAINTEXT,
  PYTHON,
  R,
  RACKET,
  RUBY,
  RUST,
  SCALA,
  SCHEME,
  SHELL,
  SPARQL,
  SQL,
  SYSTEM_VERILOG,
  TERRAFORM,
  TOML,
  TSX,
  TYPESCRIPT,
  VUE,
  WEBASSEMBLY,
  XML,
  YAML,
} as const;

export const codeBlockLanguageNames: Record<CodeBlockLanguage, string> = {
  [C]: 'C',
  [CPP]: 'C++',
  [CSHARP]: 'C#',
  [CLOJURE]: 'Clojure',
  [CSS]: 'CSS',
  [DART]: 'Dart',
  [DOCKERFILE]: 'Dockerfile',
  [ELIXIR]: 'Elixir',
  [ERLANG]: 'Erlang',
  [GO]: 'Go',
  [GRAPHQL]: 'GraphQL',
  [HASKELL]: 'Haskell',
  [HTML]: 'HTML',
  [JAVA]: 'Java',
  [JAVASCRIPT]: 'JavaScript',
  [JSON]: 'JSON',
  [JSX]: 'JSX',
  [KOTLIN]: 'Kotlin',
  [LATEX]: 'LaTeX',
  [MAKEFILE]: 'Makefile',
  [MARKDOWN]: 'Markdown',
  [OCAML]: 'OCaml',
  [PERL]: 'Perl',
  [PHP]: 'PHP',
  [PLAINTEXT]: 'Plain Text',
  [PYTHON]: 'Python',
  [R]: 'R',
  [RACKET]: 'Racket',
  [RUBY]: 'Ruby',
  [RUST]: 'Rust',
  [SCALA]: 'Scala',
  [SCHEME]: 'Scheme',
  [SHELL]: 'Shell Script',
  [SPARQL]: 'SPARQL',
  [SQL]: 'SQL',
  [SYSTEM_VERILOG]: 'SystemVerilog',
  [TERRAFORM]: 'Terraform',
  [TOML]: 'TOML',
  [TSX]: 'TSX',
  [TYPESCRIPT]: 'TypeScript',
  [VUE]: 'Vue',
  [WEBASSEMBLY]: 'WebAssembly',
  [XML]: 'XML',
  [YAML]: 'YAML',
};

export type CodeBlockLanguage = ValueOf<typeof codeBlockLanguages>;
