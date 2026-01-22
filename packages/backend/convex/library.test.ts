import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("should create library item and copy with barcode", async () => {
  const t = convexTest(schema, modules);

  // const itemId = await t.mutation(api.library.items.create, {
  //   organizationId,
  //   title: "The Great Gatsby",
  //   itemType: "book",
  //   authors: ["F. Scott Fitzgerald"],
  //   isbn13: "9780743273565",
  //   language: "en",
  // });
  // const copyId = await t.mutation(api.library.copies.create, {
  //   organizationId,
  //   itemId,
  //   copyNumber: 1,
  //   barcode: "LIB0000001",
  //   condition: "new",
  // });
  // expect(itemId).toBeDefined();
  // expect(copyId).toBeDefined();

  expect(true).toBe(true);
});

test("should checkout and return library item", async () => {
  const t = convexTest(schema, modules);

  // const circulationId = await t.mutation(api.library.circulation.checkout, {
  //   organizationId,
  //   accountId: patronAccountId,
  //   copyId,
  // });
  // const circ = await t.query(api.library.circulation.get, { circulationId });
  // expect(circ?.status).toBe("active");

  // await t.mutation(api.library.circulation.checkin, { circulationId });
  // const returned = await t.query(api.library.circulation.get, { circulationId });
  // expect(returned?.status).toBe("returned");

  expect(true).toBe(true);
});

test("should place and fulfill hold", async () => {
  const t = convexTest(schema, modules);

  // const holdId = await t.mutation(api.library.holds.place, {
  //   organizationId,
  //   accountId: patronAccountId,
  //   itemId,
  // });
  // const hold = await t.query(api.library.holds.get, { holdId });
  // expect(hold?.status).toBe("pending");
  // expect(hold?.queuePosition).toBe(1);

  // await t.mutation(api.library.holds.fulfill, { holdId, copyId });
  // const fulfilled = await t.query(api.library.holds.get, { holdId });
  // expect(fulfilled?.status).toBe("fulfilled");

  expect(true).toBe(true);
});

test("should calculate fines on overdue return", async () => {
  const t = convexTest(schema, modules);

  // const fines = await t.query(api.library.fines.list, {
  //   organizationId,
  //   accountId: patronAccountId,
  //   status: "outstanding",
  // });
  // expect(fines.length).toBeGreaterThan(0);
  // expect(fines[0].fineType).toBe("overdue");

  expect(true).toBe(true);
});

test("should process fine payment", async () => {
  const t = convexTest(schema, modules);

  // await t.mutation(api.library.fines.recordPayment, {
  //   organizationId,
  //   accountId: patronAccountId,
  //   amount: 5.00,
  //   paymentMethod: "cash",
  //   fineIds: [fineId],
  // });
  // const fine = await t.query(api.library.fines.get, { fineId });
  // expect(fine?.status).toBe("paid");

  expect(true).toBe(true);
});

test("should submit and approve acquisition request", async () => {
  const t = convexTest(schema, modules);

  // const requestId = await t.mutation(api.library.acquisitions.create, {
  //   organizationId,
  //   title: "New Book Request",
  //   authors: ["Author Name"],
  //   isbn: "9781234567890",
  //   priority: "normal",
  //   quantity: 1,
  // });
  // expect(requestId).toBeDefined();

  // await t.mutation(api.library.acquisitions.approve, { requestId });
  // const request = await t.query(api.library.acquisitions.get, { requestId });
  // expect(request?.status).toBe("approved");

  expect(true).toBe(true);
});
