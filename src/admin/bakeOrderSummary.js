export function summariseBakeOrders(orders) {
  const active = orders.filter(order => !order.cancelled && !order.duplicate && order.orderNumber);
  const quantities = new Map();
  for (const order of active) for (const item of order.items) quantities.set(item.name, (quantities.get(item.name) || 0) + item.quantity);
  return {
    orders: active.length, completed: active.filter(o => o.completed).length,
    unpaid: active.filter(o => !o.paid).length,
    unpaidCents: active.filter(o => !o.paid && o.amountCents !== null).reduce((n, o) => n + o.amountCents, 0),
    items: [...quantities].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
