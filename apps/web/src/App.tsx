import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { OrdersPage } from './pages/OrdersPage';
import { PaymentPage } from './pages/PaymentPage';
import { PosPage } from './pages/PosPage';
import { ReceiptPage } from './pages/ReceiptPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<PosPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id/pay" element={<PaymentPage />} />
        <Route path="/orders/:id/receipt" element={<ReceiptPage />} />
      </Route>
    </Routes>
  );
}
