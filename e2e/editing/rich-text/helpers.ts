import { openHelloMd, openProjectFolder } from '../../shared/helpers';

export const setupEditor = async ({
  electronApp,
  window,
  testProjectDir,
}: {
  electronApp: Parameters<typeof openProjectFolder>[0]['electronApp'];
  window: Parameters<typeof openProjectFolder>[0]['window'];
  testProjectDir: string;
}) => {
  await openProjectFolder({ electronApp, window, folderPath: testProjectDir });
  await openHelloMd({ window });
};
