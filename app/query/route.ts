import { db } from "@vercel/postgres";

const client = await db.connect();

async function listInvoices() {
  try {
    const data = await client.sql`
      SELECT invoices.amount, customers.name
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE invoices.amount = 666;
    `;
    return data.rows;
  } catch (error) {
    // 更好的错误处理
    console.error("Database error:", error);
    throw error;
  } finally {
    // 确保关闭连接
    // await client.end();
  }
}

export async function GET() {
  try {
    return Response.json(await listInvoices());
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
