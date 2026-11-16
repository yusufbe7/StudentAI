import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Finance from './pages/Finance.jsx';
import UsersPage from './pages/Users.jsx';
import Payments from './pages/Payments.jsx';
import Broadcast from './pages/Broadcast.jsx';
import Moderation from './pages/Moderation.jsx';
import Content from './pages/Content.jsx';
import Tournament from './pages/Tournament.jsx';
import Channels from './pages/Channels.jsx';
import Activity from './pages/Activity.jsx';
import SettingsPage from './pages/Settings.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="finance" element={<Finance />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="payments" element={<Payments />} />
          <Route path="broadcast" element={<Broadcast />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="content" element={<Content />} />
          <Route path="tournament" element={<Tournament />} />
          <Route path="channels" element={<Channels />} />
          <Route path="activity" element={<Activity />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
