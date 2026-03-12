import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { FileText, Trash2, Loader2 } from "lucide-react";
import { useReports, useDeleteReport, downloadReportUrl } from "@/hooks/use-reports";

interface Props {
  portfolioId: string | undefined;
}

export function ReportArchiveTable({ portfolioId }: Props) {
  const { data: reports, isLoading } = useReports(portfolioId);
  const deleteReport = useDeleteReport();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Report Archive</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (!reports || reports.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No reports generated yet.
                </TableCell>
              </TableRow>
            )}
            {reports?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">
                  {r.generated_at ? new Date(r.generated_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize text-xs">{r.type}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {r.summary_sentence ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.status === "complete" ? "default" :
                      r.status === "failed" ? "destructive" :
                      "secondary"
                    }
                    className="text-xs"
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right flex items-center justify-end gap-1">
                  {r.status === "complete" && r.file_path && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(downloadReportUrl(r.id), "_blank")}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      View PDF
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deleteReport.isPending}
                      >
                        {deleteReport.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete report?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this report and its generated file. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() =>
                            deleteReport.mutate({
                              reportId: r.id,
                              portfolioId: r.portfolio_id,
                            })
                          }
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
