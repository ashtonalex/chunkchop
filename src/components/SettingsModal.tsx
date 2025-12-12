import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
        // @ts-ignore
        window.ipcRenderer.invoke('get-api-key').then((key: string) => {
            if (key) setGeminiApiKey(key);
        });
        // @ts-ignore
        window.ipcRenderer.invoke('get-openrouter-api-key').then((key: string) => {
            if (key) setOpenRouterApiKey(key);
        });
    }
  }, [isOpen]);

  const handleSave = async () => {
    // @ts-ignore
    await window.ipcRenderer.invoke('save-api-key', geminiApiKey);
    // @ts-ignore
    await window.ipcRenderer.invoke('save-openrouter-api-key', openRouterApiKey);
    setSaved(true);
    setTimeout(() => {
        setSaved(false);
        onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4">Settings</h2>
        
        <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-2">OpenRouter API Key</label>
            <input 
                type="password" 
                value={openRouterApiKey}
                onChange={(e) => setOpenRouterApiKey(e.target.value)}
                placeholder="Enter OpenRouter API Key"
                className="w-full bg-gray-900 border border-gray-700 text-white p-2 rounded focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
                Primary AI model. Get your key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">OpenRouter</a>.
            </p>
        </div>

        <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-2">Gemini API Key</label>
            <input 
                type="password" 
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Enter AI Studio Key"
                className="w-full bg-gray-900 border border-gray-700 text-white p-2 rounded focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
                Fallback AI model. Key stored locally.
            </p>
        </div>

        <div className="flex justify-end gap-2">
            <button 
                onClick={onClose}
                className="px-4 py-2 rounded text-gray-300 hover:bg-gray-700 transition"
            >
                Cancel
            </button>
            <button 
                onClick={handleSave}
                className={`px-4 py-2 rounded font-bold text-white transition ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
                {saved ? 'Saved!' : 'Save'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
