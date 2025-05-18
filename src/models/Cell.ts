import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm"
import { Sector } from "./Sector"
import { Village } from "./Village"

@Entity("cells")
export class Cell {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @ManyToOne(
    () => Sector,
    (sector) => sector.cells,
  )
  @JoinColumn({ name: "sector_id" })
  sector: Sector

  @OneToMany(
    () => Village,
    (village) => village.cell,
  )
  villages: Village[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
