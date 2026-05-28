const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

exports.default = async function(context) {
  if (process.platform !== 'darwin') return;

  const appleId = process.env.APPLE_ID;
  const applePassword = process.env.APPLE_APP_PASSWORD;
  const teamId = 'S3AAUL8U96';

  if (!appleId || !applePassword) {
    console.log('Skipping notarization: set APPLE_ID and APPLE_APP_PASSWORD to notarize.');
    return;
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productName}.app`
  );

  console.log(`Notarizing ${appPath}...`);

  const zipPath = path.join(context.appOutDir, 'notarize-upload.zip');
  execSync(`ditto -c -k --keepParent "${appPath}" "${zipPath}"`, { stdio: 'inherit' });

  try {
    execSync(
      `xcrun notarytool submit "${zipPath}" --apple-id "${appleId}" --password "${applePassword}" --team-id "${teamId}" --wait`,
      { stdio: 'inherit' }
    );
    console.log('Stapling notarization ticket...');
    execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });
    console.log('Notarization complete.');
  } finally {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  }
};
