import type { User as UserType } from '../services/auth'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import AppLayout from '../components/AppLayout'
import { User, CreditCard } from 'lucide-react'

interface SettingsProps {
  user: UserType
}

export default function Settings({ user }: SettingsProps) {
  return (
    <AppLayout user={user} title="Settings">
      <div className="max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>Manage your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <Input value={user.email ?? 'Guest (anonymous session)'} disabled />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Full Name
                </label>
                <Input value={user.full_name || ''} placeholder="Not set" disabled />
              </div>
            </CardContent>
          </Card>

          {/* kb_token Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                kb_token Balance
              </CardTitle>
              <CardDescription>Your AI usage credits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary mb-2">{user.kb_token_balance}</div>
              <p className="text-sm text-muted-foreground">
                kb_token are consumed when using AI features like card generation, task breakdown, and workflow analysis.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
