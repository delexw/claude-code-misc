# Step 5: Save and Present Results

Save each PIR as a separate markdown file in `.pir-tmp/`, using the naming convention:

```
.pir-tmp/
├── PIR-YYYY-MM-DD-<short-slug>.md   # One file per PIR
└── ...
```

Where `<short-slug>` is a kebab-case summary of the incident (e.g. `admin-health-check`, `web-idp-degradation`).

Each PIR file should follow the output template in [PIR Form Fields](../references/pir-form-fields.md).

After writing all files, display a summary table to the user listing the files, their severity, and incident title. Include the data sources status:

```
### Data Sources
- PagerDuty: [✅ Success — N incidents found / ❌ Skipped — reason]
- Datadog: [✅ Success / ❌ Skipped — reason]
- Cloudflare: [✅ Success / ❌ Skipped — reason]
```

Inform the user of the output directory: `.pir-tmp/`

Ask the user to review. Offer to adjust any field or regenerate individual PIRs.
