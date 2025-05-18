import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm"
import { User } from "./User"
import { Ticket } from "./Ticket"

@Entity("ticket_comments")
export class TicketComment {
  @PrimaryGeneratedColumn()
  id: number

  @Column("text")
  content: string

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User

  @ManyToOne(
    () => Ticket,
    (ticket) => ticket.comments,
  )
  @JoinColumn({ name: "ticket_id" })
  ticket: Ticket

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
