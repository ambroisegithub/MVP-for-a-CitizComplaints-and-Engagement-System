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
import { District } from "./District"
import { Cell } from "./Cell"

@Entity("sectors")
export class Sector {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @ManyToOne(
    () => District,
    (district) => district.sectors,
  )
  @JoinColumn({ name: "district_id" })
  district: District

  @OneToMany(
    () => Cell,
    (cell) => cell.sector,
  )
  cells: Cell[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
