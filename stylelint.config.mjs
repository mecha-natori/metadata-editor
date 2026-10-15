/** @type {import('stylelint').Config} */
const config = {
    extends: ['stylelint-config-standard'],
    plugins: [
        'stylelint-declaration-block-no-ignored-properties',
        'stylelint-order'
    ],
    rules: {
        'alpha-value-notation': 'number',
        'at-rule-no-deprecated': true,
        'at-rule-no-unknown': [true, { ignoreAtRules: ['theme'] }],
        'at-rule-prelude-no-invalid': [true, { ignoreAtRules: ['apply'] }],
        'color-hex-length': 'short',
        'function-no-unknown': [true, { ignoreFunctions: ['theme'] }],
        'length-zero-no-unit': true,
        'order/order': [
            'dollar-variables',
            'custom-properties',
            'declarations',
            'at-rules',
            'rules'
        ],
        'order/properties-alphabetical-order': true,
        'plugin/declaration-block-no-ignored-properties': true,
        'selector-pseudo-class-no-unknown': [
            true,
            { ignorePseudoClasses: ['global'] }
        ],
        'selector-pseudo-element-colon-notation': 'double',
        'shorthand-property-no-redundant-values': true
    }
};

export default config;
