import tseslint from "typescript-eslint";

// Dependency direction: domain <- application <- infrastructure <- apps.
// Cross-folder imports must use aliases, never "../".
const forbid = (...aliases) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        { group: ["../**"], message: "Use an alias import (@domain/..., @application/...)." },
        ...aliases.map((a) => ({ group: [`${a}/*`], message: `This layer must not depend on ${a}.` })),
      ],
    },
  ],
});

export default tseslint.config(
  { ignores: ["dist", "out", "node_modules"] },
  ...tseslint.configs.recommended,
  { files: ["src/domain/**/*.ts"], rules: forbid("@application", "@infrastructure", "@apps") },
  { files: ["src/application/**/*.ts"], rules: forbid("@infrastructure", "@apps") },
  { files: ["src/infrastructure/**/*.ts"], rules: forbid("@apps") },
  { files: ["apps/**/*.ts", "tests/**/*.ts"], rules: forbid() },
);
