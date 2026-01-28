module.exports = {
  "types": [
    { type: "feat", section: "Added", hidden: false },
    { type: "fix", section: "Fixed", hidden: false },
    { type: "perf", section: "Performance Improvements", hidden: false },
    { type: "docs", section: "Documentation", hidden: false },
    { type: "chore", section: "Chores", hidden: false },
    { type: "refactor", section: "Code Refactoring", hidden: false },
    { type: "test", section: "Tests", hidden: false },
    { type: "build", section: "Build System", hidden: false },
    { type: "ci", section: "Continuous Integration", hidden: false }
  ],
  "scripts": {
    "postchangelog": "node scripts/update-service-worker.js && git add service-worker.js"
  }
};
