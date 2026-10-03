import React from 'react';
import { StationRouter } from './components/StationRouter';
import { LicenseGate } from './components/LicenseGate';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-600">
      <LicenseGate>
        <StationRouter />
      </LicenseGate>
    </div>
  );
};

export default App;
