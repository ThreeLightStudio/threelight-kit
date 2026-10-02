import { createRoot } from 'react-dom/client';
import App from '@/App';
import './styles.css';

const root = document.getElementById('root');
if (!root)
  throw new Error(
    'The application root is missing. Add <div id="root"></div> to apps/web/index.html.',
  );
createRoot(root).render(<App />);
