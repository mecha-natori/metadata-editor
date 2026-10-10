import { Edit } from './edit';
import { Home } from './home';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

const router = createBrowserRouter([
    { element: <Home />, index: true },
    { element: <Edit />, path: '/edit/:board' }
]);

createRoot(document.querySelector('#root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
);
