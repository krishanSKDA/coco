import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <EmptyState
      icon={<SearchX className="size-6" />}
      title="Page not found"
      description="The plot or observation you are looking for does not exist on this device."
      action={<ButtonLink to="/">Back to dashboard</ButtonLink>}
    />
  )
}
