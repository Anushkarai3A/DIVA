import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { QmsNavbar } from './QmsNavbar';
import { useAppDispatch } from '../../app/hooks';
import { loadConfig } from '../../features/deviation/deviationApi';

export function QMSLayout() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(loadConfig());
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-[var(--page)]">
      <QmsNavbar />
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-10 pt-6 lg:px-6">
        <Outlet />
      </main>
    </div>
  );
}
