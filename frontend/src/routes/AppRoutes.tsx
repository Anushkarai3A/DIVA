import { Navigate, Route, Routes } from 'react-router-dom';
import { QMSLayout } from '../components/layout/QMSLayout';
import { Dashboard } from '../pages/Dashboard';
import { Deviations } from '../pages/Deviations';
import { DeviationDetails } from '../pages/DeviationDetails';
import { NewDeviation } from '../pages/NewDeviation';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<QMSLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/deviations" element={<Deviations />} />
        <Route path="/deviations/new" element={<Navigate to="/new-deviation" replace />} />
        <Route path="/new-deviation" element={<NewDeviation />} />
        <Route path="/deviations/:id" element={<DeviationDetails />} />
        <Route path="/ai-copilot" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
