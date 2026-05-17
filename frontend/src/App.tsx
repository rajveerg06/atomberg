import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GoalsList from './pages/GoalsList';
import GoalForm from './pages/GoalForm';
import ManagerReview from './pages/ManagerReview';
import Checkins from './pages/Checkins';

const PrivateRoute = ({ children, roles }: { children: React.ReactNode, roles?: string[] }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/goals" element={<PrivateRoute><GoalsList /></PrivateRoute>} />
          <Route path="/goals/new" element={<PrivateRoute roles={['employee', 'manager', 'admin']}><GoalForm /></PrivateRoute>} />
          <Route path="/goals/:id/edit" element={<PrivateRoute roles={['employee', 'manager', 'admin']}><GoalForm /></PrivateRoute>} />
          
          <Route path="/team/review" element={<PrivateRoute roles={['manager', 'admin']}><ManagerReview /></PrivateRoute>} />
          <Route path="/team/checkins" element={<PrivateRoute roles={['manager', 'admin']}><Checkins /></PrivateRoute>} />
          
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
