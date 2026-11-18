import mongoose from 'mongoose';
import { VALIDATORS } from './validators';

/**
 * MongoDB thật (MONGO_TEST_URI): mọi validator phải được máy chủ CHẤP NHẬN. Bắt lỗi cú pháp $jsonSchema mà TypeScript không thấy
 * (vd. MongoDB dùng `exclusiveMinimum: true` kèm `minimum`, không phải số như JSON Schema bản mới).
 */
const URI = process.env.MONGO_TEST_URI;

describe.skipIf(!URI)('validator được MongoDB chấp nhận', () => {
  let conn: mongoose.Connection;
  beforeAll(async () => {
    conn = await mongoose.createConnection(URI!, { dbName: `kiem_thu_validator_${process.pid}`, autoCreate: false }).asPromise();
  });
  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });

  for (const [ten, def] of Object.entries(VALIDATORS)) {
    it(`${ten}: tạo collection kèm validator (strict/error)`, async () => {
      await conn.createCollection(ten, { validator: def.validator, validationLevel: 'strict', validationAction: 'error' });
      const info = (await conn.db!.listCollections({ name: ten }).toArray())[0] as any;
      expect(info.options.validator).toEqual(def.validator);
    });
  }
});
