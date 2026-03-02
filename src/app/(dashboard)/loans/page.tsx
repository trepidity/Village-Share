import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatDate, relativeDate } from "@/lib/utils/dates"
import { HandHeart, Calendar, Clock, Store, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type BorrowStatus = "requested" | "active" | "returned" | "cancelled"

interface LoanRow {
  id: string
  status: BorrowStatus
  due_at: string | null
  borrowed_at: string | null
  returned_at: string | null
  created_at: string
  items: { name: string; photo_url: string | null } | null
  shops: { name: string } | null
  profiles: { display_name: string | null } | null
}

function statusBadgeVariant(
  status: BorrowStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default"
    case "returned":
      return "secondary"
    case "cancelled":
      return "destructive"
    case "requested":
      return "outline"
    default:
      return "outline"
  }
}

function statusLabel(status: BorrowStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default async function LoansPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get all shops owned by this user
  const { data: shops } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)

  const shopIds = (shops ?? []).map((s) => s.id)

  // If user owns no shops, there are no loans
  if (shopIds.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Loans</h1>
          <p className="text-muted-foreground">
            Track items you&apos;ve lent out from your collections.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HandHeart className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No loans yet</CardTitle>
            <CardDescription>
              When someone borrows items from your collections, they will appear
              here.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: borrows } = await supabase
    .from("borrows")
    .select(
      "*, items(name, photo_url), shops:from_shop_id(name), profiles:borrower_id(display_name)"
    )
    .in("from_shop_id", shopIds)
    .order("created_at", { ascending: false })

  const allLoans = (borrows ?? []) as unknown as LoanRow[]
  const activeLoans = allLoans.filter(
    (b) => b.status === "active" || b.status === "requested"
  )
  const pastLoans = allLoans.filter(
    (b) => b.status === "returned" || b.status === "cancelled"
  )

  const isEmpty = allLoans.length === 0

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Loans</h1>
        <p className="text-muted-foreground">
          Track items you&apos;ve lent out from your collections.
        </p>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HandHeart className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No loans yet</CardTitle>
            <CardDescription>
              When someone borrows items from your collections, they will appear
              here.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active Loans Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Active Loans</h2>
              {activeLoans.length > 0 && (
                <Badge variant="default" className="ml-1">
                  {activeLoans.length}
                </Badge>
              )}
            </div>

            {activeLoans.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active loans right now.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Collection</TableHead>
                      <TableHead>Lent</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeLoans.map((loan) => {
                      const isOverdue =
                        loan.status === "active" &&
                        loan.due_at &&
                        new Date(loan.due_at) < new Date()

                      return (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium">
                            {loan.items?.name ?? "Unknown item"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              {loan.profiles?.display_name ?? "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Store className="h-3.5 w-3.5" />
                              {loan.shops?.name ?? "Unknown collection"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {loan.borrowed_at
                              ? formatDate(loan.borrowed_at)
                              : loan.status === "requested"
                                ? "Pending"
                                : formatDate(loan.created_at)}
                          </TableCell>
                          <TableCell>
                            {loan.due_at ? (
                              <span
                                className={
                                  isOverdue
                                    ? "text-destructive font-medium"
                                    : ""
                                }
                              >
                                {relativeDate(loan.due_at)}
                                {isOverdue && " (overdue)"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(loan.status)}>
                              {statusLabel(loan.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </section>

          {/* Past Loans Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Past Loans</h2>
              {pastLoans.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pastLoans.length}
                </Badge>
              )}
            </div>

            {pastLoans.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No past loans.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Collection</TableHead>
                      <TableHead>Lent</TableHead>
                      <TableHead>Returned</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium">
                          {loan.items?.name ?? "Unknown item"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            {loan.profiles?.display_name ?? "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Store className="h-3.5 w-3.5" />
                            {loan.shops?.name ?? "Unknown collection"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {loan.borrowed_at
                            ? formatDate(loan.borrowed_at)
                            : formatDate(loan.created_at)}
                        </TableCell>
                        <TableCell>
                          {loan.returned_at
                            ? formatDate(loan.returned_at)
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(loan.status)}>
                            {statusLabel(loan.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}
