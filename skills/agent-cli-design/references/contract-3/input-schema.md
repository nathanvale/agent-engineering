# Input declarations and generated schemas

Candidate wording for A11 and A12. No schema library or production API is
selected. The exact public format below is proposed for acceptance with the text.

## One executable owner

**INPUT-1 `[A 11]` `[A 12]` `[P]`** Each command's executable input declaration
owns positional arguments, options, parsing and validation. Generate command
discovery's `input` from that declaration. Human help uses the same metadata.
A second manually maintained schema or parser is invalid. Navigation never
executes the handler or initialises a domain provider to enumerate declarations.
The checker compares the projection with independently authored input cases;
matching two wrong generated outputs is not sufficient proof.

## Proposed wire format

**INPUT-2 `[A 12]` `[P]`** `CommandDiscoveryData.input` is a strict object:

```text
InputSchema = {
  arguments: ArgumentSchema[],
  options: OptionSchema[],
  constraints: Constraint[],
  deadlineSupported: boolean,
  additionalArguments: false,
  additionalOptions: false
}
ArgumentSchema = { name, summary, required, value: ValueSchema }
OptionSchema = { name, aliases: string[], summary, required,
                 repeatable, value: ValueSchema | null }
ValueSchema = { kind: "string", minLength, maxLength, choices: string[] | null, pattern: string | null }
            | { kind: "integer", minimum, maximum }
Constraint = { kind: "requires", ifPresent, thenPresent }
           | { kind: "exclusive", members: string[] }
```

The objects and variants are strict, with no other keys. Arguments are ordered;
3.0.0 has no implicit rest argument. Required arguments precede optional ones.
Names identify unique input slots across arguments and options. An option name
is its canonical `--long-name`; aliases are distinct declared option tokens and
cannot shadow global switches. `value: null` is a boolean presence flag; other
options consume exactly one following token. Repetition is rejected unless
`repeatable` is true. Missing required slots, unknown flags and extra operands
are usage refusals. Presence flags are absent/false or present/true; they take
no arbitrary truthy string.

A bound, choice, pattern or cross-slot violation is refused with
`USAGE_INVALID_INVOCATION`, exit 2, before guards or effects; decoded external
payload/state schema failures remain `SCHEMA_INVALID_INPUT`. Options accept
exact declared tokens followed by separate value tokens. Abbreviations,
short-option bundles and `--name=value` are not admitted at 3.0.0. Repeatable
value options retain occurrence order; repeated presence flags are rejected
and a presence flag cannot declare `repeatable: true`.

String bounds are nonnegative safe integers measured in Unicode code points;
maximum is at least minimum. `choices`, when present, is a nonempty unique list
of allowed literal strings satisfying those bounds. A non-null pattern is a declaration-owned valid ECMAScript
Unicode regular expression, with full-string matching, no caller-supplied
flags, and no stateful global/sticky mode. The declaration owner bounds its
input and qualifies its matching cost; discovery never executes a pattern on
untrusted data. The same matcher serves parser and checker; independent
expected cases prevent a shared wrong matcher becoming its own oracle.
A reader treats another CLI's pattern as untrusted. It validates syntax and
matches only inside a terminable execution boundary under its own finite input,
pattern-size and time budgets, frozen and tested before release. Exceeding a
budget refuses the schema check with `SCHEMA_INVALID_INPUT`; it never retries
an already-executed target. A declaration's own cost claim is not sufficient.
V-44 includes an adversarial backtracking pattern whose budget exhaustion must
terminate the check without blocking the reader's lifecycle.
Integer bounds are safe
integers. Integer argv tokens match `^-?(0|[1-9][0-9]*)$`, parse without precision
loss and satisfy the inclusive bounds. No implicit coercion of an empty string,
float, infinity or unsafe integer. Metadata summaries are fixed nonempty text.

Constraint references resolve to declared slot names. `requires` means when
one slot occurs, the other must occur. `exclusive` has at least two distinct
members and allows at most one to occur. No unsatisfiable combination of
required slots and constraints is admitted. Optional means absence remains
available to the handler; no hidden parser defaults or undeclared option
abbreviations. Future richer forms require an explicit schema extension and
reader-first rollout, not an opaque unchecked escape hatch.

`deadlineSupported` is projected from the executable deadline declaration.
When true, the applicable grammar includes LIFE-5's positive-integer
`--deadline-ms` option; when false it rejects that option. The global options
in DISC-1, DISC-2 and LIFE-5 are kernel-owned declarations.
Discovery lists their applicable syntax through HelpData and their built-in
commands. Command schemas describe command-specific tokens; the checker
combines these with the applicable global grammar. A domain declaration may
not shadow `--json`, `--help`, discovery routes or a supported deadline switch.

## Parsing and runtime boundaries

**INPUT-3 `[C0]` `[A 12]` `[P]`** Parse strictly from `unknown` before any guard
or effect (CMD-9). A positional operand beginning with `-` must follow `--`; before it, an
unrecognised dash-prefixed token is a usage error. A declared value-taking
option consumes its following value token, including a negative integer, after
global-switch handling. `--` ends option parsing; later tokens are operands, including
`--json`. Command-step arguments exclude the global `--json` switch. The base
resolves the canonical command identity before parsing its arguments; an
operand can never select a different command. Explicit navigation has no domain
effects, including on invalid selectors and inaccessible integrations.

**INPUT-4 `[A 6]` `[A 12]` `[P]`** The declaration must express every accepted argv grammar constraint in its
public projection. INPUT-2 defines the admitted grammar; unsupported syntax is
a declaration/admission error rather than a hidden custom parser. Constraints
on decoded JSON, files and live domain state belong to runtime validation,
not a promise that argv metadata proves their contents. Do not hide a special keyword
that changes an operand's meaning in an ad hoc parser. Declare a finite choice
where appropriate. A syntactically valid value can still fail runtime domain,
resource, schema or authority validation. Such validation remains mandatory and
is not advertised as proven by the input schema. Dynamic allowed resources
are not enumerated by doing network work during discovery.

The writer validates bound step arguments against the target declaration's
syntax after substitution, before output. The target validates again before
use. Secrets, current authority, resource existence and trustworthy run values
cannot be established from this static schema alone.

## Navigation and proof

**INPUT-5 `[A 11]` `[A 12]` `[P]`** The navigation path is existing help or
`--discover`, then `--discover-command <identity>`, then a declared route with
valid arguments. Command discovery exposes that command's input and possible
stations, not every station in the CLI. Built-ins are discoverable too.

V-43 verifies navigation reaches the original dispatcher and old commands
still work. V-44 varies required inputs, bounds, choices, aliases, repetition,
constraints, unknown options and `--`; parser, projected schema and actual
process behaviour must agree. Include a hostile catalogue that agrees with a
wrong parser: independent expected cases must still fail it. No domain writes,
subprocess effects, credentials or network access occur merely to navigate.

## TypeScript example

Illustrative, not compiled and not a promised API:

```ts
const showNote = command({
  identity: "notes.show",
  route: ["notes", "show"],
  input: {
    arguments: [
      textArgument("noteId", { required: true, minLength: 1, maxLength: 80 }),
    ],
    options: [flag("--details")],
  },
  run(input) {
    // The same declaration supplies parser behaviour and discovery metadata.
    // Resource existence and permission are still checked at runtime here.
    return readNote(input.noteId, input.details);
  },
});
```

This text does not claim TypeScript proves that `noteId` exists or that the
caller has permission. Those are runtime checks owned by the command.
