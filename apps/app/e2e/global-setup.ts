import { chmodSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { E2E_OBJECT_TITLE } from "./fixtures";

const localQaLib = pathToFileURL(
  resolve(__dirname, "../../../scripts/local-qa/lib.mjs"),
).href;

/**
 * Signs the QA user in for the browser and makes sure the catalog has an
 * object to open, since the seed creates none.
 */
export default async function globalSetup() {
  const {
    qaStorageState,
    readQaCredentials,
    readState,
    signInQaUser,
    stateDir,
  } = await import(localQaLib);

  const { storageState } = await qaStorageState();
  const storageStatePath = join(stateDir, "storage-state.json");
  writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
  chmodSync(storageStatePath, 0o600);

  const { state } = readState();
  const { email, password } = readQaCredentials();
  const { client, api } = await signInQaUser(state.url, email, password);
  const [organization] = await client.query(
    api.organizations.listUserOrganizations,
    {},
  );
  const objects = await client.query(api.collections.list, {
    organizationId: organization._id,
    paginationOpts: { numItems: 100, cursor: null },
  });
  const hasFixture = objects.page.some(
    (object: { title: string }) => object.title === E2E_OBJECT_TITLE,
  );
  if (!hasFixture) {
    await client.mutation(api.collections.create, {
      organizationId: organization._id,
      title: E2E_OBJECT_TITLE,
    });
  }
}
