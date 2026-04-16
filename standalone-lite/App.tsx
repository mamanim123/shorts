import React from 'react';
import TubeFactoryPanel from './features/shorts-lab/components/TubeFactoryPanel';

const App: React.FC = () => {
  return (
    <div className="relative flex h-screen w-full bg-[#020617] text-white overflow-hidden">
      <div className="relative z-10 flex h-full w-full">
        <TubeFactoryPanel />
      </div>
    </div>
  );
};

export default App;
