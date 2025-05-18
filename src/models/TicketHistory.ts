import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./User"
import { Ticket } from "./Ticket"
import { TicketStatus } from "../enums/TicketStatus"

@Entity("ticket_history")
export class TicketHistory {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: "enum",
    enum: TicketStatus,
  })
  status: TicketStatus

  @Column({ nullable: true, type: "text" })
  note: string

  @ManyToOne(() => User)
  @JoinColumn({ name: "reviewed_by_user_id" })
  reviewedBy: User

  @ManyToOne(
    () => Ticket,
    (ticket) => ticket.statusHistory,
  )
  @JoinColumn({ name: "ticket_id" })
  ticket: Ticket

  @CreateDateColumn()
  timestamp: Date
}
