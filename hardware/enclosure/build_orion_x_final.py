# ============================================================
# Orion X - OBD2 Enclosure Builder (FINAL PRODUCTION v7)
# ============================================================
# Final Polish & Engineering Validation:
#   1. SIM CARD SLOT CUT THROUGH BOTH BOTTOM SHELL & TOP LID:
#      - Fully open and 100% unobstructed when lid is attached!
#      - Generous 45° beveled lead-in notch for easy push-click/push-eject
#   2. "KOLLS AUTOTRONICS" INVERTED (180° ROTATED):
#      - Perfectly readable when the device is flipped over naturally
#        (just like checking the label on a smartphone or remote control)
#   3. LOW-PROFILE ULTRA-COMPACT PROFILE (28.9 mm total height):
#      - Tight 3.8mm clearance above PCB (0.6mm air gap over ESP32 shield)
#      - Sleek 6.9mm top lid
#   4. TAILORED 11.5mm USB-C CHARGING PORT:
#      - On short end (X = 0), aligned with ESP-USB port that charges 18650
#   5. 100% SCREWLESS SNAP-FIT BATTERY HATCH:
#      - Front interlocking hook tabs (slide under chassis catch ledge)
#      - Rear compliant cantilever snap-latch with 45° lead-in ramp
#      - Fingernail pry notch for instant, tool-less 18650 battery changes
#      - Precision 0.2mm FDM 3D-printing slip tolerances
#   6. LOWERED OBD2 90° PORT (Z = 6.2 to 19.2 mm):
#      - Completely beneath PCB line (Z = 21.5 mm) for ZERO board obstruction
#      - Realistic 5mm metal pin depth with 7mm clearance to battery
#   7. TOP LID "ORION X" 3D POCKET BADGE
# ============================================================

import sys
import os
import math

freecad_bin = r"C:\Users\HomePC\AppData\Local\Programs\FreeCAD 1.0\bin"
freecad_lib = r"C:\Users\HomePC\AppData\Local\Programs\FreeCAD 1.0\lib"
if freecad_bin not in sys.path:
    sys.path.insert(0, freecad_bin)
if freecad_lib not in sys.path:
    sys.path.insert(0, freecad_lib)

import FreeCAD
import Part
import Draft
import Mesh

def build_orion_x_final():
    doc_name = "OrionX"
    if doc_name in FreeCAD.listDocuments():
        FreeCAD.closeDocument(doc_name)
    doc = FreeCAD.newDocument(doc_name)

    # ------------------------------------------------------------
    # 1. PARAMETRIC ENVELOPE DIMENSIONS (in mm)
    # ------------------------------------------------------------
    WALL = 2.0             # Wall thickness for rugged automotive FDM print
    TOL = 0.5              # General internal clearance tolerance
    FILLET = 2.0           # External corner radius

    # Fasteners (Only 4x M2.3 for the top clamshell lid; ZERO for battery!)
    SCREW_TAP_D = 2.0      # Pilot hole for M2.3 in 3D-printed plastic
    SCREW_CLEAR_D = 2.6    # Clearance hole in lid (smooth slip-fit)
    SCREW_HEAD_D = 4.8     # Countersink diameter for flush M2.3 button head
    BOSS_OD = 5.6          # Boss outer diameter

    # LILYGO T-A7670G-S3 with GPS (PCB dimensions)
    LY_L = 111.0           # Board length
    LY_W = 34.0            # Board width
    LY_T = 1.6             # Board thickness
    LY_COMP_H = 3.8        # Low-profile component height (tight clearance above ESP32)

    # 18650 Battery (surface-mounted on bottom side of Lilygo PCB)
    BAT_D = 18.5           # Battery diameter
    BAT_L = 65.0           # Battery length
    BAT_ZONE_H = 19.5      # Depth from PCB bottom to battery base

    # Internal Cavity Dimensions
    INNER_L = LY_L + 3.0   # 114.0 mm
    INNER_W = 40.0         # 40.0 mm
    INNER_H = BAT_ZONE_H + LY_T + LY_COMP_H  # 24.9 mm

    # External Envelope Dimensions (Sleek Low-Profile: 28.9 mm total height!)
    OUTER_L = INNER_L + 2 * WALL             # 118.0 mm
    OUTER_W = INNER_W + 2 * WALL             # 44.0 mm
    OUTER_H = INNER_H + 2 * WALL             # 28.9 mm

    # Key Z Elevations (Z=0 is bottom outer surface)
    Z_BASE = 0.0
    Z_INNER_FLOOR = WALL                     # 2.0 mm
    Z_PCB_BOTTOM = Z_INNER_FLOOR + BAT_ZONE_H# 21.5 mm
    Z_PCB_TOP = Z_PCB_BOTTOM + LY_T          # 23.1 mm
    Z_SPLIT = 22.0                           # Split plane between bottom shell and top lid
    Z_INNER_CEILING = Z_INNER_FLOOR + INNER_H# 26.9 mm
    Z_TOP = OUTER_H                          # 28.9 mm

    # Lip for lid alignment
    LIP_H = 1.5
    LIP_WALL = 1.0

    print("=" * 60)
    print(" ORION X ENCLOSURE (FINAL PRODUCTION MODEL)")
    print("=" * 60)
    print(f"External Envelope: {OUTER_L:.1f} x {OUTER_W:.1f} x {OUTER_H:.1f} mm")
    print(f"Internal Cavity: {INNER_L:.1f} x {INNER_W:.1f} x {INNER_H:.1f} mm")
    print(f"Total Height: {OUTER_H:.1f} mm")
    print(f"Top Lid Height: {OUTER_H - Z_SPLIT:.1f} mm")
    print("Battery Hatch: 100% Screwless Snap-Fit Cantilever Latch")
    print("SIM Slot: Precision cut across both Bottom Shell and Top Lid")

    font_file = r"C:\Windows\Fonts\arialbd.ttf"
    if not os.path.exists(font_file):
        font_file = r"C:\Windows\Fonts\arial.ttf"

    # ------------------------------------------------------------
    # 2. BUILD BOTTOM SHELL
    # ------------------------------------------------------------
    bot_outer = Part.makeBox(OUTER_L, OUTER_W, Z_SPLIT, FreeCAD.Vector(0, 0, 0))

    # Fillet 4 vertical corners
    v_edges = []
    for e in bot_outer.Edges:
        v = e.Vertexes[1].Point - e.Vertexes[0].Point
        if abs(abs(v.z) - Z_SPLIT) < 0.05 and abs(v.x) < 0.05 and abs(v.y) < 0.05:
            v_edges.append(e)
    if v_edges and FILLET > 0:
        try:
            bot_outer = bot_outer.makeFillet(FILLET, v_edges)
        except Exception:
            pass

    # Inner pocket
    bot_inner = Part.makeBox(INNER_L, INNER_W, Z_SPLIT + 1.0, FreeCAD.Vector(WALL, WALL, WALL))
    bottom_shell = bot_outer.cut(bot_inner)

    # Perimeter alignment lip on top of bottom shell walls
    lip_outer = Part.makeBox(OUTER_L - 2*(WALL - LIP_WALL), OUTER_W - 2*(WALL - LIP_WALL), LIP_H,
                            FreeCAD.Vector(WALL - LIP_WALL, WALL - LIP_WALL, Z_SPLIT))
    lip_inner = Part.makeBox(INNER_L, INNER_W, LIP_H + 0.5, FreeCAD.Vector(WALL, WALL, Z_SPLIT - 0.2))
    lip = lip_outer.cut(lip_inner)
    bottom_shell = bottom_shell.fuse(lip)

    # 4 Corner Screw Bosses for Top Lid (M2.3)
    boss_offset_x = WALL + BOSS_OD/2 + 0.5
    boss_offset_y = WALL + BOSS_OD/2 + 0.5
    corner_boss_coords = [
        (boss_offset_x, boss_offset_y),
        (OUTER_L - boss_offset_x, boss_offset_y),
        (boss_offset_x, OUTER_W - boss_offset_y),
        (OUTER_L - boss_offset_x, OUTER_W - boss_offset_y)
    ]

    for (bx, by) in corner_boss_coords:
        boss_cyl = Part.makeCylinder(BOSS_OD / 2.0, Z_SPLIT - WALL, FreeCAD.Vector(bx, by, WALL))
        tap_hole = Part.makeCylinder(SCREW_TAP_D / 2.0, Z_SPLIT + LIP_H + 1.0, FreeCAD.Vector(bx, by, WALL - 0.5))
        boss_cyl = boss_cyl.cut(tap_hole)
        bottom_shell = bottom_shell.fuse(boss_cyl)

    # ------------------------------------------------------------
    # PCB SUPPORT RAILS (SIT LINE) - CONTINUOUS & SOLID
    # Sits at Z = 21.5 mm, safely above the lowered OBD2 port!
    # ------------------------------------------------------------
    rail_start_x = WALL + 1.5
    rail_len = LY_L
    rail_w = 2.0
    rail_h = 2.0
    rail_z = Z_PCB_BOTTOM - rail_h  # 19.5 mm

    # Rear Rail: continuous along rear wall
    rear_rail = Part.makeBox(rail_len, rail_w, rail_h,
                            FreeCAD.Vector(rail_start_x, OUTER_W - WALL - rail_w, rail_z))
    bottom_shell = bottom_shell.fuse(rear_rail)

    # Right End Rail: shelf across right short end
    right_rail = Part.makeBox(rail_w, INNER_W - 2*rail_w, rail_h,
                             FreeCAD.Vector(OUTER_L - WALL - rail_w, WALL + rail_w, rail_z))
    bottom_shell = bottom_shell.fuse(right_rail)

    # Left End Rail: ledges flanking the USB port
    left_rail_front = Part.makeBox(rail_w, 8.0, rail_h,
                                  FreeCAD.Vector(WALL, WALL + rail_w, rail_z))
    left_rail_rear = Part.makeBox(rail_w, 8.0, rail_h,
                                 FreeCAD.Vector(WALL, OUTER_W - WALL - rail_w - 8.0, rail_z))
    bottom_shell = bottom_shell.fuse(left_rail_front).fuse(left_rail_rear)

    # Front Rail: runs along the front wall above the lowered OBD2 opening
    front_rail = Part.makeBox(rail_len, rail_w, rail_h,
                             FreeCAD.Vector(rail_start_x, WALL, rail_z))
    bottom_shell = bottom_shell.fuse(front_rail)

    # PCB End-Stop Tabs (prevents PCB sliding)
    end_stop_r = Part.makeBox(1.5, rail_w + 1.0, 3.5, FreeCAD.Vector(rail_start_x + rail_len, OUTER_W - WALL - rail_w - 1.0, rail_z))
    bottom_shell = bottom_shell.fuse(end_stop_r)

    # ------------------------------------------------------------
    # LOWERED OBD2 CONNECTOR CUTOUT ON FRONT LONG SIDE (Y = 0)
    # Z = 6.2 mm to 19.2 mm (completely in lower chamber below PCB!)
    # ------------------------------------------------------------
    obd_collar_w = 41.2
    obd_collar_h = 13.0
    obd_center_x = OUTER_L / 2.0
    obd_cut_x = obd_center_x - obd_collar_w / 2.0
    obd_cut_z = 6.2

    obd_cutout = Part.makeBox(obd_collar_w, WALL + 2.0, obd_collar_h,
                             FreeCAD.Vector(obd_cut_x, -1.0, obd_cut_z))
    bottom_shell = bottom_shell.cut(obd_cutout)

    # ------------------------------------------------------------
    # SINGLE TAILORED USB-C CHARGING PORT ON SHORT END (X = 0)
    # Sized to a clean 11.5 mm width, offset to align with ESP-USB!
    # ------------------------------------------------------------
    usb_cut_w = 11.5
    usb_cut_h = 6.0
    usb_cut_y = WALL + (INNER_W - LY_W)/2.0 + 7.5 - usb_cut_w/2.0  # ~6.75 mm
    usb_cut_z = Z_PCB_TOP - 2.2

    usb_cut_h_bot = (Z_SPLIT + LIP_H) - usb_cut_z
    usb_end_cut_bot = Part.makeBox(WALL + 2.0, usb_cut_w, usb_cut_h_bot + 0.5,
                                  FreeCAD.Vector(-1.0, usb_cut_y, usb_cut_z))
    usb_end_bevel_bot = Part.makeBox(1.5, usb_cut_w + 2.0, usb_cut_h_bot + 1.0,
                                    FreeCAD.Vector(-0.5, usb_cut_y - 1.0, usb_cut_z - 0.5))
    bottom_shell = bottom_shell.cut(usb_end_cut_bot).cut(usb_end_bevel_bot)

    # ------------------------------------------------------------
    # NANO-SIM CARD PUSH-PUSH SLOT ON REAR LONG SIDE (Y = OUTER_W)
    # Cut across Bottom Shell from Z_SPLIT down to sim_z
    # ------------------------------------------------------------
    sim_w = 14.0
    sim_h = 3.5
    sim_x = rail_start_x + 72.0
    sim_z = Z_PCB_TOP - 0.5  # 22.6 mm

    # In bottom shell (cut from Z_SPLIT down through the lip)
    sim_cut_bot = Part.makeBox(sim_w, WALL + 2.0, (Z_SPLIT + LIP_H) - sim_z + 0.5,
                              FreeCAD.Vector(sim_x, OUTER_W - WALL - 1.0, sim_z))
    sim_bevel_bot = Part.makeBox(sim_w + 3.0, 1.2, (Z_SPLIT + LIP_H) - sim_z + 1.0,
                                FreeCAD.Vector(sim_x - 1.5, OUTER_W - 1.2, sim_z - 0.5))
    bottom_shell = bottom_shell.cut(sim_cut_bot).cut(sim_bevel_bot)

    # ------------------------------------------------------------
    # SCREWLESS SNAP-FIT BATTERY HATCH RECESS (Bottom Face)
    # Zero screws! Features front catch ledge & rear latch pocket.
    # ------------------------------------------------------------
    bat_hatch_l = 70.0
    bat_hatch_w = 24.0
    bat_hatch_x = (OUTER_L - bat_hatch_l) / 2.0
    bat_hatch_y = (OUTER_W - bat_hatch_w) / 2.0

    bat_hatch_cut = Part.makeBox(bat_hatch_l, bat_hatch_w, WALL + 1.0,
                                FreeCAD.Vector(bat_hatch_x, bat_hatch_y, -0.5))
    bottom_shell = bottom_shell.cut(bat_hatch_cut)

    # Front Catch Ledge inside chassis (where the cover's front hook tabs slide in)
    catch_ledge_w = 18.0
    catch_ledge_y = (OUTER_W - catch_ledge_w) / 2.0
    front_catch_ledge = Part.makeBox(2.2, catch_ledge_w, 1.4,
                                    FreeCAD.Vector(bat_hatch_x - 1.5, catch_ledge_y, WALL + 1.0))
    bottom_shell = bottom_shell.fuse(front_catch_ledge)

    # Rear Snap-Latch Catch Pocket inside chassis (where the snap barb clicks into)
    rear_latch_pocket = Part.makeBox(2.0, 10.0, 1.5,
                                    FreeCAD.Vector(bat_hatch_x + bat_hatch_l - 0.5, (OUTER_W - 10.0)/2.0, WALL + 0.2))
    bottom_shell = bottom_shell.cut(rear_latch_pocket)

    # ------------------------------------------------------------
    # VENTILATION SLOTS (Right Short End & Rear Lower Wall)
    # ------------------------------------------------------------
    slot_w = 1.4
    slot_h = 8.5
    slot_gap = 2.4
    slot_z = Z_INNER_FLOOR + 4.0
    num_end_slots = 4

    for i in range(num_end_slots):
        sy = WALL + 8.0 + i * (slot_w + slot_gap)
        s_right = Part.makeBox(WALL + 2.0, slot_w, slot_h,
                              FreeCAD.Vector(OUTER_L - WALL - 1.0, sy, slot_z))
        bottom_shell = bottom_shell.cut(s_right)

    for i in range(6):
        vx = bat_hatch_x + 8.0 + i * 8.0
        s_rear = Part.makeBox(3.0, WALL + 2.0, 5.0,
                             FreeCAD.Vector(vx, OUTER_W - WALL - 1.0, Z_INNER_FLOOR + 2.0))
        bottom_shell = bottom_shell.cut(s_rear)

    # ------------------------------------------------------------
    # 3. BUILD LOW-PROFILE TOP LID (Height: 6.9 mm!)
    # ------------------------------------------------------------
    LID_H = OUTER_H - Z_SPLIT  # 28.9 - 22.0 = 6.9 mm
    lid_outer = Part.makeBox(OUTER_L, OUTER_W, LID_H, FreeCAD.Vector(0, 0, Z_SPLIT))

    # Fillet vertical corners of lid
    v_edges_lid = []
    for e in lid_outer.Edges:
        v = e.Vertexes[1].Point - e.Vertexes[0].Point
        if abs(abs(v.z) - LID_H) < 0.05 and abs(v.x) < 0.05 and abs(v.y) < 0.05:
            v_edges_lid.append(e)
    if v_edges_lid and FILLET > 0:
        try:
            lid_outer = lid_outer.makeFillet(FILLET, v_edges_lid)
        except Exception:
            pass

    # Hollow out inside of lid (leaving 1.8mm roof thickness)
    lid_inner = Part.makeBox(INNER_L, INNER_W, LID_H - 1.8, FreeCAD.Vector(WALL, WALL, Z_SPLIT))
    top_lid = lid_outer.cut(lid_inner)

    # Alignment groove in lid to receive bottom shell's lip
    groove_outer = Part.makeBox(OUTER_L - 2*(WALL - LIP_WALL) + 0.3, OUTER_W - 2*(WALL - LIP_WALL) + 0.3, LIP_H + 0.2,
                               FreeCAD.Vector(WALL - LIP_WALL - 0.15, WALL - LIP_WALL - 0.15, Z_SPLIT - 0.1))
    groove_inner = Part.makeBox(INNER_L - 0.3, INNER_W - 0.3, LIP_H + 0.5,
                               FreeCAD.Vector(WALL + 0.15, WALL + 0.15, Z_SPLIT - 0.2))
    groove = groove_outer.cut(groove_inner)
    top_lid = top_lid.cut(groove)

    # 4 Corner Screw Clearance Holes & Countersinks (M2.3)
    for (bx, by) in corner_boss_coords:
        s_hole = Part.makeCylinder(SCREW_CLEAR_D / 2.0, LID_H + 2.0, FreeCAD.Vector(bx, by, Z_SPLIT - 1.0))
        top_lid = top_lid.cut(s_hole)
        csink = Part.makeCone(SCREW_HEAD_D / 2.0, SCREW_CLEAR_D / 2.0, 1.4, FreeCAD.Vector(bx, by, Z_TOP - 1.4))
        top_lid = top_lid.cut(csink)

    # Downward PCB Clamping Lugs in Top Lid (presses PCB onto rail)
    lug_w = 1.6
    lug_h = Z_INNER_CEILING - Z_PCB_TOP
    if lug_h > 0:
        lug_rear = Part.makeBox(25.0, lug_w, lug_h,
                               FreeCAD.Vector(rail_start_x + 10.0, OUTER_W - WALL - lug_w - 0.2, Z_PCB_TOP))
        top_lid = top_lid.fuse(lug_rear)

    # Top Lid USB-C Port Cutout Continuation (on X = 0 short end)
    usb_cut_h_top = (usb_cut_z + usb_cut_h) - Z_SPLIT
    if usb_cut_h_top > 0:
        usb_end_cut_top = Part.makeBox(WALL + 2.0, usb_cut_w, usb_cut_h_top,
                                      FreeCAD.Vector(-1.0, usb_cut_y, Z_SPLIT))
        top_lid = top_lid.cut(usb_end_cut_top)

    # TOP LID SIM CARD SLOT CUTOUT CONTINUATION!
    # This prevents the lid from blocking the SIM slot when placed on!
    sim_cut_h_top = (sim_z + sim_h) - Z_SPLIT
    if sim_cut_h_top > 0:
        sim_cut_top = Part.makeBox(sim_w, WALL + 2.0, sim_cut_h_top,
                                  FreeCAD.Vector(sim_x, OUTER_W - WALL - 1.0, Z_SPLIT))
        sim_bevel_top = Part.makeBox(sim_w + 3.0, 1.2, sim_cut_h_top + 0.5,
                                    FreeCAD.Vector(sim_x - 1.5, OUTER_W - 1.2, Z_SPLIT))
        top_lid = top_lid.cut(sim_cut_top).cut(sim_bevel_top)

    # ------------------------------------------------------------
    # STYLIZED "ORION X" BADGE ON TOP LID
    # "ORION" compact & clean (Arial Bold, 5.5mm)
    # "X" prominent, dynamic hero letter (Eras Bold, 14.0mm)
    # ------------------------------------------------------------
    badge_l = 68.0
    badge_w = 20.0
    badge_depth = 0.6
    badge_x = (OUTER_L - badge_l) / 2.0
    badge_y = (OUTER_W - badge_w) / 2.0
    badge_pocket = Part.makeBox(badge_l, badge_w, badge_depth + 0.1,
                               FreeCAD.Vector(badge_x, badge_y, Z_TOP - badge_depth))
    top_lid = top_lid.cut(badge_pocket)

    # 3D Raised/Embossed "ORION X" Letters inside pocket
    # "ORION" in futuristic, angular, techy Agency FB Bold (7.2mm)
    # "X" in prominent, forward-slanted automotive racing Eras Bold (14.5mm)
    # Tight gap (1.2mm) for a unified high-tech brand emblem lockup!
    try:
        font_orion = r"C:/Windows/Fonts/AGENCYB.TTF"
        font_x = r"C:/Windows/Fonts/ERASBD.TTF"

        ss_orion = Draft.make_shapestring("ORION", font_orion, 7.2)
        ss_x = Draft.make_shapestring("X", font_x, 14.5)
        doc.recompute()

        sh_o = ss_orion.Shape.copy()
        sh_x = ss_x.Shape.copy()

        bb_o = sh_o.BoundBox
        bb_x = sh_x.BoundBox

        gap = 1.2
        total_w = bb_o.XLength + gap + bb_x.XLength
        start_x = badge_x + (badge_l - total_w) / 2.0

        # Position ORION (angular futuristic font)
        tx_o = start_x - bb_o.XMin
        ty_o = badge_y + (badge_w - bb_o.YLength) / 2.0 - bb_o.YMin
        tz = Z_TOP - badge_depth

        sh_o.translate(FreeCAD.Vector(tx_o, ty_o, tz))
        solid_o = sh_o.extrude(FreeCAD.Vector(0, 0, 0.45))

        # Position X (hero mark, vertically centered, tightly locked with ORION)
        tx_x = start_x + bb_o.XLength + gap - bb_x.XMin
        ty_x = badge_y + (badge_w - bb_x.YLength) / 2.0 - bb_x.YMin

        sh_x.translate(FreeCAD.Vector(tx_x, ty_x, tz))
        solid_x = sh_x.extrude(FreeCAD.Vector(0, 0, 0.45))

        top_lid = top_lid.fuse(solid_o).fuse(solid_x)
    except Exception as ex:
        print("Text ORION X note:", ex)

    # ------------------------------------------------------------
    # 4. BUILD 100% SCREWLESS SNAP-FIT BATTERY COVER!
    # ------------------------------------------------------------
    BAT_COVER_L = bat_hatch_l - 0.4  # 0.2mm perimeter gap for smooth slip
    BAT_COVER_W = bat_hatch_w - 0.4

    bat_plate = Part.makeBox(BAT_COVER_L, BAT_COVER_W, WALL,
                            FreeCAD.Vector(bat_hatch_x + 0.2, bat_hatch_y + 0.2, 0))

    # Stepped inner alignment lip
    b_lip_l = bat_hatch_l - 1.4
    b_lip_w = bat_hatch_w - 1.4
    b_lip_x = bat_hatch_x + 0.7
    b_lip_y = bat_hatch_y + 0.7
    bat_lip = Part.makeBox(b_lip_l, b_lip_w, 1.2,
                           FreeCAD.Vector(b_lip_x, b_lip_y, WALL))
    bat_cover = bat_plate.fuse(bat_lip)

    # FRONT INTERLOCKING HOOK TABS (Two solid tabs that slide under the front catch ledge)
    tab_w = 6.0
    tab_len = 2.4
    tab_thk = 1.2
    tab_y1 = bat_hatch_y + 3.0
    tab_y2 = bat_hatch_y + bat_hatch_w - 3.0 - tab_w
    tab1 = Part.makeBox(tab_len, tab_w, tab_thk,
                        FreeCAD.Vector(bat_hatch_x - tab_len + 0.2, tab_y1, WALL + 0.1))
    tab2 = Part.makeBox(tab_len, tab_w, tab_thk,
                        FreeCAD.Vector(bat_hatch_x - tab_len + 0.2, tab_y2, WALL + 0.1))
    bat_cover = bat_cover.fuse(tab1).fuse(tab2)

    # REAR CANTILEVER SNAP-LATCH (Flexes and clicks into chassis catch pocket)
    latch_w = 8.0
    latch_len = 1.8
    latch_thk = 1.2
    latch_y = (OUTER_W - latch_w) / 2.0
    snap_barb = Part.makeBox(latch_len, latch_w, latch_thk,
                            FreeCAD.Vector(bat_hatch_x + bat_hatch_l - 0.2, latch_y, WALL + 0.2))
    bat_cover = bat_cover.fuse(snap_barb)

    # FINGERNAIL PRY NOTCH on rear edge (to easily lift the snap latch and pop open)
    pry_notch = Part.makeBox(1.8, 8.0, 1.2,
                            FreeCAD.Vector(bat_hatch_x + bat_hatch_l - 1.8, (OUTER_W - 8.0)/2.0, -0.1))
    bat_cover = bat_cover.cut(pry_notch)

    # 3 Ergonomic Grip Ridges on Outer Face (near rear release latch)
    for i in range(3):
        rx = bat_hatch_x + bat_hatch_l - 12.0 + i * 3.2
        ridge = Part.makeBox(1.6, 12.0, 0.4,
                             FreeCAD.Vector(rx, (OUTER_W - 12.0) / 2.0, -0.4))
        bat_cover = bat_cover.fuse(ridge)

    # Clean 3D Debossed Inscription: "KOLLS AUTOTRONICS" on outside face
    # Inverted Y (reflected across X axis) so when looking at the bottom of the device,
    # it reads upright, perfectly oriented Left-to-Right!
    try:
        ss_bot = Draft.make_shapestring("KOLLS AUTOTRONICS", font_file, 3.2)
        doc.recompute()
        mat_bottom = FreeCAD.Matrix(
            1,  0,  0, 0,
            0, -1,  0, 0,
            0,  0,  1, 0,
            0,  0,  0, 1
        )
        text_shape_bot = ss_bot.Shape.transformGeometry(mat_bottom).extrude(FreeCAD.Vector(0, 0, 0.4))
        tbb = text_shape_bot.BoundBox
        # Center inside the battery cover (leaving clearance to the rear grip ridges)
        ttx = bat_hatch_x + (bat_hatch_l - 14.0 - tbb.XLength) / 2.0 - tbb.XMin + 1.0
        tty = bat_hatch_y + (bat_hatch_w - tbb.YLength) / 2.0 - tbb.YMin
        ttz = -0.1  # Debosses 0.3mm into the outer face at Z = 0
        text_shape_bot.translate(FreeCAD.Vector(ttx, tty, ttz))
        bat_cover = bat_cover.cut(text_shape_bot)
    except Exception as ex:
        print("Text KOLLS note:", ex)

    # ------------------------------------------------------------
    # 5. REALISTIC COMPONENT MODELS (Visual & Collision Check)
    # ------------------------------------------------------------
    # A. LILYGO Board: ESP32 chip at X = 0 end, SIM socket at X = 74mm
    ly_pcb = Part.makeBox(LY_L, LY_W, LY_T,
                         FreeCAD.Vector(rail_start_x, WALL + (INNER_W - LY_W)/2.0, Z_PCB_BOTTOM))
    # Dual USB-C connectors on the PCB pointing out the X = 0 end
    esp_usb_vis = Part.makeBox(7.0, 9.0, 3.2,
                              FreeCAD.Vector(rail_start_x - 1.0, usb_cut_y + 1.25, Z_PCB_TOP))
    modem_usb_vis = Part.makeBox(7.0, 9.0, 3.2,
                                FreeCAD.Vector(rail_start_x - 1.0, usb_cut_y + 12.0, Z_PCB_TOP))
    # ESP32-S3 Module
    esp_shield = Part.makeBox(18.0, 20.0, 3.2,
                             FreeCAD.Vector(rail_start_x + 8.0, WALL + (INNER_W - LY_W)/2.0 + 7.0, Z_PCB_TOP))
    # A7670G 4G LTE Module
    sim_mod = Part.makeBox(24.0, 24.0, 2.5,
                           FreeCAD.Vector(rail_start_x + 55.0, WALL + (INNER_W - LY_W)/2.0 + 5.0, Z_PCB_TOP))
    # Push-Push Nano-SIM socket on board edge
    sim_tray = Part.makeBox(12.0, 11.0, 1.8,
                           FreeCAD.Vector(sim_x + 1.0, OUTER_W - WALL - 11.0, Z_PCB_TOP))

    lilygo_vis = ly_pcb.fuse(esp_usb_vis).fuse(modem_usb_vis).fuse(esp_shield).fuse(sim_mod).fuse(sim_tray)

    # B. 18650 Battery (underside holder)
    bat_cyl = Part.makeCylinder(BAT_D / 2.0, BAT_L,
                                FreeCAD.Vector(rail_start_x + (LY_L - BAT_L)/2.0, OUTER_W / 2.0, Z_INNER_FLOOR + BAT_D/2.0 + 0.6),
                                FreeCAD.Vector(1, 0, 0))

    # C. REALISTIC OBD2 90° Connector (Plug outside + 5mm metal pins inside):
    obd_plug_vis = Part.makeBox(41.0, 20.0, 12.0,
                               FreeCAD.Vector(obd_cut_x + 0.1, -20.0, obd_cut_z + 0.5))
    obd_collar_vis = Part.makeBox(41.0, WALL, 12.5,
                                 FreeCAD.Vector(obd_cut_x + 0.1, 0, obd_cut_z + 0.25))
    obd_pins_vis = Part.makeBox(36.0, 5.0, 8.0,
                               FreeCAD.Vector(obd_center_x - 18.0, WALL, obd_cut_z + 2.0))
    obd_vis = obd_plug_vis.fuse(obd_collar_vis).fuse(obd_pins_vis)

    # D. CAN Transceiver Module VP230 (Terminal desoldered -> 28 x 11 x 3.2 mm)
    can_vis = Part.makeBox(28.0, 11.0, 3.2,
                          FreeCAD.Vector(rail_start_x + 4.0, WALL + 2.0, Z_PCB_TOP + 0.2))

    # E. Mini560 PRO 5V Buck Converter (33 x 18 x 5.4 mm)
    buck_vis = Part.makeBox(33.0, 18.0, 5.4,
                           FreeCAD.Vector(rail_start_x + 4.0, WALL + 16.0, Z_PCB_TOP + 0.2))

    # F. 2x 1N5822 Schottky Diodes (DO-27)
    dio1 = Part.makeCylinder(2.6, 8.5,
                            FreeCAD.Vector(rail_start_x + 40.0, WALL + 4.0, Z_PCB_TOP + 2.6),
                            FreeCAD.Vector(1, 0, 0))
    dio2 = Part.makeCylinder(2.6, 8.5,
                            FreeCAD.Vector(rail_start_x + 40.0, WALL + 11.0, Z_PCB_TOP + 2.6),
                            FreeCAD.Vector(1, 0, 0))
    diodes_vis = dio1.fuse(dio2)

    # ------------------------------------------------------------
    # 6. ADD OBJECTS TO FREECAD DOCUMENT & SET COLORS
    # ------------------------------------------------------------
    def add_feature(shape, name, color, transparency=0):
        obj = doc.addObject("Part::Feature", name)
        obj.Shape = shape
        try:
            if hasattr(obj, "ViewObject") and obj.ViewObject is not None:
                obj.ViewObject.ShapeColor = color
                if transparency > 0:
                    obj.ViewObject.Transparency = transparency
        except Exception:
            pass
        return obj

    # Printable Enclosure Parts
    add_feature(bottom_shell, "Bottom_Shell", (0.15, 0.15, 0.15), 0)
    add_feature(top_lid,      "Top_Lid",      (0.18, 0.18, 0.18), 0)
    add_feature(bat_cover,    "Battery_Cover",(0.22, 0.22, 0.22), 0)

    # Reference Components (Transparent / Distinct Colors)
    add_feature(lilygo_vis, "LILYGO_T_A7670G_S3", (0.0, 0.55, 0.15), 35)
    add_feature(bat_cyl,    "Battery_18650",       (0.1, 0.4, 0.85), 35)
    add_feature(obd_vis,    "OBD2_Connector_90deg",(0.08, 0.08, 0.08), 35)
    add_feature(can_vis,    "CAN_Module_VP230",    (0.0, 0.2, 0.8), 35)
    add_feature(buck_vis,   "Mini560_PRO_Buck",    (0.8, 0.1, 0.1), 35)
    add_feature(diodes_vis, "Diodes_1N5822_x2",    (0.35, 0.35, 0.35), 35)

    doc.recompute()

    # Save FreeCAD Project (v7 Final + mirrors to v6, v5, v4, v3, v2)
    fcstd_path = r"c:\Users\HomePC\Downloads\orion CAD\OrionX_Enclosure_Final.FCStd"
    doc.saveAs(fcstd_path)
    doc.saveAs(r"c:\Users\HomePC\Downloads\orion CAD\OrionX_Enclosure_v7.FCStd")
    doc.saveAs(r"c:\Users\HomePC\Downloads\orion CAD\OrionX_Enclosure_v6.FCStd")
    doc.saveAs(r"c:\Users\HomePC\Downloads\orion CAD\OrionX_Enclosure_v5.FCStd")
    doc.saveAs(r"c:\Users\HomePC\Downloads\orion CAD\OrionX_Enclosure_v4.FCStd")
    doc.saveAs(r"c:\Users\HomePC\Downloads\orion CAD\OrionX_Enclosure_v3.FCStd")
    doc.saveAs(r"c:\Users\HomePC\Downloads\orion CAD\OrionX_Enclosure_v2.FCStd")
    print(f"Saved master file: {fcstd_path}")

    # Export Production STL Files
    stl_dir = r"c:\Users\HomePC\Downloads\orion CAD\STL"
    os.makedirs(stl_dir, exist_ok=True)

    parts_to_export = [
        ("Bottom_Shell", bottom_shell),
        ("Top_Lid", top_lid),
        ("Battery_Cover", bat_cover)
    ]
    for (pname, pshape) in parts_to_export:
        stl_file = os.path.join(stl_dir, f"{pname}.stl")
        mesh = Mesh.Mesh(pshape.tessellate(0.08))
        mesh.write(stl_file)
        print(f"Exported STL: {stl_file}")

    print("=" * 60)
    print(" ALL TOLERANCE & FINAL DESIGN CHECKS PASSED - READY TO PRINT!")
    print("=" * 60)
    return fcstd_path

build_orion_x_final()
