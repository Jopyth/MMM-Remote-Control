const config = {
  "extends": ["stylelint-config-standard"],
  "plugins": ["stylelint-prettier"],
  "root": true,
  "rules": {
    "no-descending-specificity": null,
    "prettier/prettier": true
  }
};

export default config;
