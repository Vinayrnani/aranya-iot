# Aranya IoT CI Setup Guide

## 1. Link Repository to GitHub Actions

1. **Navigate to GitHub Actions**:
   - Open your repository on GitHub.
   - Click the **Actions** tab at the top.
   - GitHub will prompt you to set up a workflow. Skip this and proceed to the next step.

2. **Enable Workflow**:
   - Ensure the `.github/workflows/ci_placeholder.yml` file exists in your repository.
   - GitHub Actions will automatically detect and enable the workflow.
   - Verify the workflow is listed under **Actions > All workflows**.

3. **Trigger a Test Run**:
   - Push a small commit (e.g., add a blank line to a file) to trigger the workflow.
   - Check the **Actions** tab to confirm the workflow runs without errors.


## 2. Locate Firmware Binaries

After a successful build, binaries are generated in:

```
.pio/build/<environment>/
```

Where `<environment>` is:
- `esp32` (for ESP32 builds)
- `esp8266` (for ESP8266 builds)

### Key Files:
- `.bin`: Binary firmware for flashing
- `.elf`: Debug symbols
- `.hex`: Intel HEX format (alternative flashing option)


## 3. Handle S3-Compatible Uploads

### Prerequisites
- **S3-Compatible Storage**: AWS S3, Backblaze B2, MinIO, or similar.
- **Credentials**: Access Key ID and Secret Access Key with write permissions.

### Steps

1. **Generate Credentials**:
   - For AWS S3: Use IAM to create a user with `s3:PutObject` permissions.
   - For Backblaze B2: Create an **Application Key** with `writeFiles` and `listBuckets` permissions.

2. **Add Secrets to GitHub**:
   - Go to **Repository Settings > Secrets and variables > Actions**.
   - Add the following secrets:
     - `AWS_ACCESS_KEY_ID` (or `B2_KEY_ID`)
     - `AWS_SECRET_ACCESS_KEY` (or `B2_APPLICATION_KEY`)
   - For Backblaze B2, also add your **Bucket Name** as a secret.

3. **Uncomment and Configure Workflow**:
   - Open `.github/workflows/ci_placeholder.yml`.
   - Uncomment the relevant upload section (S3, GitHub Releases, or Backblaze B2).
   - Replace placeholders (e.g., `your-bucket`, `us-east-1`) with your actual values.

4. **Validate Uploads**:
   - Push a commit to trigger the workflow.
   - Verify binaries appear in your cloud storage.


## 4. Manual QA with `act`

Use [`nektos/act`](https://github.com/nektos/act) to test the workflow locally:

### Setup
```bash
# Install act
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

### Run Workflow Locally
```bash
act -j build
```

### Expected Output
- Build logs matching GitHub Actions.
- Generated binaries in `.pio/build/`.
- No errors related to missing credentials (placeholders remain commented).