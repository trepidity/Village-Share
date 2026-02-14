import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatDate, relativeDate } from "@/lib/utils/dates"
import { BookOpen, Calendar, Clock, Store } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
import { ReturnButton } from "./return-button"

type BorrowStatus = "requested" | "active" | "returned" | "cancelled"

interface BorrowRow {
  id: string
  status: BorrowStatus
  due_at: string | null
  borrowed_at: string | null
  returned_at: string | null
  created_at: string
  items: { name: string; photo_url: string | null } | null
  shops: { name: string } | null
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

export default async function BorrowsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: borrows } = await supabase
    .from("borrows")
    .select("*, items(name, photo_url), shops:from_shop_id(name)")
    .eq("borrower_id", user.id)
    .order("created_at", { ascending: false })

  const allBorrows = (borrows ?? []) as unknown as BorrowRow[]
  const activeBorrows = allBorrows.filter(
    (b) => b.status === "active" || b.status === "requested"
  )
  const pastBorrows = allBorrows.filter(
    (b) => b.status === "returned" || b.status === "cancelled"
  )

  const isEmpty = allBorrows.length === 0

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Borrows</h1>
        <p className="text-muted-foreground">
          Track your borrowed items across all shops.
        </p>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No borrows yet</CardTitle>
            <CardDescription>
              When you borrow items from a shop, they will appear here. You can
              also borrow via SMS by texting BORROW [item name].
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active Borrows Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Active Borrows</h2>
              {activeBorrows.length > 0 && (
                <Badge variant="default" className="ml-1">
                  {activeBorrows.length}
                </Badge>
              )}
            </div>

            {activeBorrows.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active borrows right now.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead>Borrowed</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeBorrows.map((borrow) => {
                      const isOverdue =
                        borrow.status === "active" &&
                        borrow.due_at &&
                        new Date(borrow.due_at) < new Date()

                      return (
                        <TableRow key={borrow.id}>
                          <TableCell className="font-medium">
                            {borrow.items?.name ?? "Unknown item"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Store className="h-3.5 w-3.5" />
                              {borrow.shops?.name ?? "Unknown shop"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {borrow.borrowed_at
                              ? formatDate(borrow.borrowed_at)
                              : borrow.status === "requested"
                                ? "Pending"
                                : formatDate(borrow.created_at)}
                          </TableCell>
                          <TableCell>
                            {borrow.due_at ? (
                              <span
                                className={
                                  isOverdue
                                    ? "text-destructive font-medium"
                                    : ""
                                }
                              >
                                {relativeDate(borrow.due_at)}
                                {isOverdue && " (overdue)"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(borrow.status)}>
                              {statusLabel(borrow.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {borrow.status === "active" && (
                              <ReturnButton borrowId={borrow.id} />
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </section>

          {/* Past Borrows Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Past Borrows</h2>
              {pastBorrows.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pastBorrows.length}
                </Badge>
              )}
            </div>

            {pastBorrows.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No past borrows.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead>Borrowed</TableHead>
                      <TableHead>Returned</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastBorrows.map((borrow) => (
                      <TableRow key={borrow.id}>
                        <TableCell className="font-medium">
                          {borrow.items?.name ?? "Unknown item"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Store className="h-3.5 w-3.5" />
                            {borrow.shops?.name ?? "Unknown shop"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {borrow.borrowed_at
                            ? formatDate(borrow.borrowed_at)
                            : formatDate(borrow.created_at)}
                        </TableCell>
                        <TableCell>
                          {borrow.returned_at
                            ? formatDate(borrow.returned_at)
                            : "--"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(borrow.status)}>
                            {statusLabel(borrow.status)}
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
