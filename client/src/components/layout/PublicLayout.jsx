import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ComparatorBar from '../ui/ComparatorBar';
import FloatingWhatsAppButton from '../ui/FloatingWhatsAppButton';
import usePageViewTracking from '../../hooks/usePageViewTracking';

export default function PublicLayout() {
  usePageViewTracking();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#1a1f2e]">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ComparatorBar />
      <FloatingWhatsAppButton />
    </div>
  );
}
