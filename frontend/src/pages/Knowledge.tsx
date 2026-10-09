import { BadgeCheck } from 'lucide-react'
import { PageHeader, Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge, CategoryBadge } from '@/components/ui/Badges'
import { Callout } from '@/components/ui/Misc'
import { KNOWLEDGE_BASE } from '@/data/knowledgeBase'
import { DISEASES, SEVERITY_SCALE } from '@/lib/constants'

export default function Knowledge() {
  return (
    <>
      <PageHeader title="Knowledge base" subtitle="Curated management guidance and diagnostic reference. Every recommendation shown in the app is traceable to an entry here (NFR-06)." />

      <Callout tone="warn" className="mb-6" title="Prototype content">
        Entries summarise published integrated disease management principles and must be reviewed and approved by CRI / extension experts before field use. The system never
        prescribes pesticide products or doses.
      </Callout>

      <div className="grid gap-4 md:grid-cols-2">
        {KNOWLEDGE_BASE.map((k) => (
          <Card key={k.id}>
            <CardBody>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-stone-400">{k.id}</span>
                {k.category === 'all' ? <Badge>All windows</Badge> : <CategoryBadge category={k.category} short />}
                <Badge tone="violet">{k.type}</Badge>
                {k.reviewStatus === 'approved' ? (
                  <Badge tone="green" icon={<BadgeCheck className="size-3" />}>
                    Approved
                  </Badge>
                ) : (
                  <Badge>Pending review</Badge>
                )}
              </div>
              <h3 className="mt-2 font-semibold text-stone-900">{k.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{k.summary}</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-stone-700">
                {k.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-stone-500">
                Applies to: {k.diseases === 'all' ? 'all foliar diseases' : k.diseases.map((d) => DISEASES[d].label).join(', ')} · Source: {k.source}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Severity rubric (Table 3)" subtitle="Used for annotation and for the 0–4 severity estimate" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {SEVERITY_SCALE.map((s) => (
                  <tr key={s.score} className="border-b border-stone-100 last:border-0">
                    <td className="py-2.5 pl-5">
                      <span className="inline-flex size-7 items-center justify-center rounded-md font-semibold text-white" style={{ backgroundColor: s.color }}>
                        {s.score}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-stone-900">{s.label}</p>
                      <p className="text-xs text-stone-500">{s.criteria}</p>
                    </td>
                    <td className="py-2.5 pr-5 text-right text-xs whitespace-nowrap text-stone-600">{s.area}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Foliar diseases covered" />
          <CardBody className="space-y-4">
            {Object.entries(DISEASES)
              .filter(([k]) => k !== 'healthy')
              .map(([k, d]) => (
                <div key={k}>
                  <p className="font-medium text-stone-900">{d.label}</p>
                  <p className="text-xs text-stone-500 italic">{d.pathogen}</p>
                  <p className="mt-0.5 text-sm text-stone-600">{d.description}</p>
                </div>
              ))}
            <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">
              Disease intensity correlates negatively with temperature and positively with relative humidity and rainfall; grey leaf spot intensity ranged from 23.9 % (June) to
              40.5 % (December) on the same cultivar and site [5].
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
