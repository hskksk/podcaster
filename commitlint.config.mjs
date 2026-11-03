/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  defaultIgnores: true,
  // The built-in matcher misses GitHub's full PR merge subject.
  ignores: [(message) => /^Merge pull request #\d+ from \S+/.test(message)],
  rules: {
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
  },
};
