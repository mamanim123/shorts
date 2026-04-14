import React from 'react';
import TubeFactoryPanel from './features/shorts-lab/components/TubeFactoryPanel';

const App: React.FC = () => {
  return (
    <div className="flex h-screen w-full bg-[#151a24] text-white overflow-hidden">
      <TubeFactoryPanel />
    </div>
  );
};

export default App;
