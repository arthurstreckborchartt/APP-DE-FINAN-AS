import { createBrowserRouter, Navigate, useParams } from 'react-router'
import { PublicOnly, RequireAuth, RequireOnboarded } from './guards'
import { AppShell } from './AppShell'
import LoginPage from '../features/auth/LoginPage'
import SignupPage from '../features/auth/SignupPage'
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage'
import ResetPasswordPage from '../features/auth/ResetPasswordPage'
import OnboardingPage from '../features/onboarding/OnboardingPage'
import AccountsPage from '../features/accounts/AccountsPage'
import CategoriesPage from '../features/categories/CategoriesPage'
import CardsPage from '../features/cards/CardsPage'
import CardDetailPage from '../features/cards/CardDetailPage'
import RecurringPage from '../features/recurring/RecurringPage'
import GroupsPage from '../features/groups/GroupsPage'
import GroupDetailPage from '../features/groups/GroupDetailPage'
import JoinGroupPage from '../features/groups/JoinGroupPage'
import BudgetsPage from '../features/budgets/BudgetsPage'
import GoalsPage from '../features/goals/GoalsPage'
import ReportsPage from '../features/reports/ReportsPage'
import SettingsPage from '../features/settings/SettingsPage'
import HomePage from '../features/home/HomePage'
import TransactionsPage from '../features/transactions/TransactionsPage'
import TransactionFormPage from '../features/transactions/TransactionFormPage'

function TransactionFormRoute() {
  const { id } = useParams()
  return <TransactionFormPage key={id ?? 'new'} />
}

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
              { path: '/', element: <HomePage /> },
              { path: '/transactions', element: <TransactionsPage /> },
              { path: '/new', element: <TransactionFormRoute /> },
              { path: '/transactions/:id/edit', element: <TransactionFormRoute /> },
              { path: '/cards', element: <CardsPage /> },
              { path: '/cards/:id', element: <CardDetailPage /> },
              { path: '/groups', element: <GroupsPage /> },
              { path: '/groups/:id', element: <GroupDetailPage /> },
              { path: '/join/:token', element: <JoinGroupPage /> },
              { path: '/accounts', element: <AccountsPage /> },
              { path: '/categories', element: <CategoriesPage /> },
              { path: '/recurring', element: <RecurringPage /> },
              { path: '/budgets', element: <BudgetsPage /> },
              { path: '/goals', element: <GoalsPage /> },
              { path: '/reports', element: <ReportsPage /> },
              { path: '/more', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
