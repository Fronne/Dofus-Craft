<!--
Sync Impact Report
- Version change: unversioned template -> 1.0.0
- Modified principles: none (initial adoption)
- Added sections: Core Principles; Project Constraints; Development Workflow; Governance
- Removed sections: none
- Follow-up TODOs: TODO(RATIFICATION_DATE): The original adoption date is unknown; replace
  this marker when it is recovered.
-->
# Dofus Craft Constitution

## Core Principles

### I. Accurate, Traceable Game Data
Every item, recipe, resource, and calculation presented by the project MUST be traceable to a
defined source and source version. Data transformations MUST preserve stable identifiers and
record their origin. When data is uncertain, stale, or unavailable, the product MUST identify it
as such rather than present it as authoritative. This keeps crafting decisions trustworthy.

### II. Correctness Before Optimization
Crafting requirements, quantities, costs, and result calculations MUST be implemented as explicit,
testable rules. Changes to these rules MUST include automated tests for normal cases, boundaries,
and invalid or incomplete inputs. Performance work MUST retain the same observable results; a
faster incorrect calculation is not acceptable.

### III. User Decisions Remain Explainable
The application MUST show the material requirements, assumptions, and calculation inputs behind
each recommendation or total. It MUST distinguish user-entered values from derived values and
make rounding, missing-price handling, and unavailable-data behavior explicit. Users need enough
context to verify a craft plan without relying on hidden logic.

### IV. Small, Cohesive Changes
Each feature or change MUST have a narrow, documented purpose and avoid unrelated refactoring.
New abstractions, dependencies, and configuration MUST be introduced only when they solve a
demonstrated current requirement. This preserves a maintainable foundation while the product and
its data model evolve.

### V. Safe Handling of User Data
The project MUST collect and retain only the user data required for an explicitly supported
workflow. Secrets, credentials, and private user data MUST NOT be committed to the repository or
written to client-visible logs. Destructive actions affecting saved craft lists or settings MUST
require clear user confirmation or offer a practical recovery path.

## Project Constraints

The project MUST keep game data, business rules, and presentation concerns separately
maintainable. External game-data and price sources MUST be isolated behind documented import or
adapter boundaries so a source can be refreshed or replaced without rewriting user workflows.

Supported behavior, data freshness expectations, and known limitations MUST be documented near
the relevant feature. Features MUST fail safely when external data is unavailable: they may show
an incomplete result, but MUST NOT fabricate values.

## Development Workflow

Work MUST begin with a written specification for user-visible behavior and acceptance criteria.
Implementation plans MUST identify affected data contracts, calculation rules, and test coverage.
Before a change is accepted, review MUST verify compliance with the Core Principles, automated
tests MUST pass, and user-facing calculation changes MUST include representative examples.

Defects in data or calculations MUST be triaged by their potential impact on user decisions.
Corrections MUST identify the affected data or rule, add a regression test when feasible, and
communicate any material limitation to users of the affected output.

## Governance

This constitution supersedes conflicting project conventions. Contributors and reviewers MUST
check proposed work for compliance with its principles, constraints, and workflow. Exceptions
MUST be documented in the relevant specification or change record with their rationale, scope,
and removal condition.

Amendments require a documented proposal, review of affected specifications and plans, and an
updated Sync Impact Report. Constitution versions follow semantic versioning: MAJOR for
incompatible principle or governance redefinitions, MINOR for added or materially expanded
requirements, and PATCH for clarifications that do not change required behavior. Every amendment
MUST update the Last Amended date. Compliance is reviewed during specification, implementation
planning, code review, and release readiness.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date unknown | **Last Amended**: 2026-09-13
