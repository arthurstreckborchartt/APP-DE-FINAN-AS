import { createBrowserRouter, Navigate } from 'react-router'
import { PublicOnly, RequireAuth, RequireOnboarded } from './guards'
import { AppShell } from './AppShell'
import PlaceholderPage from './PlaceholderPage'
import LoginPage from '../features/auth/LoginPage'
import SignupPage from '../features/auth/SignupPage'
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage'
import ResetPasswordPage from '../features/auth/ResetPasswordPage'
import OnboardingPage from '../features/onboarding/OnboardingPage'
import AccountsPage from '../features/accounts/AccountsPage'
import CategoriesPage from '../features/categories/CategoriesPage'
import SettingsPage from '../features/settings/SettingsPage'
import TransactionFormPage from '../features/transactions/TransactionFormPage'

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <RequireOnboarded />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <PlaceholderPage titleKey="nav.home" /> },
              { path: '/transactions', element: <PlaceholderPage titleKey="nav.transactions" /> },
              { path: '/new', element: <TransactionFormPage /> },
              { path: '/transactions/:id/edit', element: <TransactionFormPage /> },
              { path: '/cards', element: <PlaceholderPage titleKey="nav.cards" /> },
              { path: '/groups', element: <PlaceholderPage titleKey="nav.groups" /> },
              { path: '/accounts', element: <AccountsPage /> },
              { path: '/categories', element: <CategoriesPage /> },
              { path: '/more', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
