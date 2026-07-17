import tkinter as tk
from tkinter import messagebox, ttk

from hospital_management.auth import authenticate_user, get_available_modules, get_user_role
from hospital_management.modules import MODULE_DETAILS
from hospital_management.styles import COLORS


class HospitalApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Hospital Personal & Patient Management")
        self.root.geometry("950x700")
        self.root.configure(bg=COLORS["background"])
        self.current_user = None
        self.build_login_screen()

    def build_login_screen(self):
        self.clear_screen()
        self.frame = ttk.Frame(self.root, padding=28)
        self.frame.pack(expand=True)
        self.frame.configure(style="Card.TFrame")

        title = ttk.Label(self.frame, text="Hospital Management System", font=("Segoe UI", 20, "bold"))
        title.pack(pady=(0, 20))

        subtitle = ttk.Label(self.frame, text="Secure access for staff and patients", font=("Segoe UI", 11))
        subtitle.pack(pady=(0, 24))

        ttk.Label(self.frame, text="Username").pack(anchor="w")
        self.username_var = tk.StringVar()
        ttk.Entry(self.frame, textvariable=self.username_var).pack(fill="x", pady=(0, 10))

        ttk.Label(self.frame, text="Password").pack(anchor="w")
        self.password_var = tk.StringVar()
        entry_password = ttk.Entry(self.frame, textvariable=self.password_var, show="*")
        entry_password.pack(fill="x", pady=(0, 16))

        ttk.Button(self.frame, text="Login", command=self.handle_login).pack(fill="x")

    def build_home_screen(self):
        self.clear_screen()
        self.frame = ttk.Frame(self.root, padding=24)
        self.frame.pack(fill="both", expand=True)

        header = ttk.Label(self.frame, text=f"Welcome, {self.current_user}", font=("Segoe UI", 18, "bold"))
        header.pack(anchor="w", pady=(0, 12))

        role = get_user_role(self.current_user)
        subtitle = ttk.Label(self.frame, text=f"Role: {role}", font=("Segoe UI", 11))
        subtitle.pack(anchor="w", pady=(0, 20))

        ttk.Label(self.frame, text="Available modules", font=("Segoe UI", 12, "bold")).pack(anchor="w")

        modules = get_available_modules(role)
        for module in modules:
            card = ttk.Frame(self.frame, padding=12)
            card.pack(fill="x", pady=6)
            ttk.Label(card, text=self.format_module_name(module), font=("Segoe UI", 11, "bold")).pack(anchor="w")
            ttk.Label(card, text=self.module_description(module), wraplength=700).pack(anchor="w")
            ttk.Button(card, text="Open", command=lambda m=module: self.open_module(m)).pack(anchor="e", pady=(8, 0))

        ttk.Button(self.frame, text="Logout", command=self.logout).pack(anchor="e", pady=(20, 0))

    def clear_screen(self):
        for widget in self.root.winfo_children():
            widget.destroy()

    def handle_login(self):
        username = self.username_var.get().strip()
        password = self.password_var.get().strip()
        if authenticate_user(username, password):
            self.current_user = username
            self.build_home_screen()
        else:
            messagebox.showerror("Login failed", "Invalid username or password")

    def logout(self):
        self.current_user = None
        self.build_login_screen()

    def open_module(self, module):
        details = MODULE_DETAILS.get(module)
        if not details:
            messagebox.showinfo("Module", "This module is not available for your role")
            return
        self.clear_screen()
        self.frame = ttk.Frame(self.root, padding=24)
        self.frame.pack(fill="both", expand=True)
        ttk.Label(self.frame, text=details["name"], font=("Segoe UI", 18, "bold")).pack(anchor="w", pady=(0, 12))
        ttk.Label(self.frame, text=details["description"], wraplength=700).pack(anchor="w", pady=(0, 12))
        ttk.Label(self.frame, text=details["content"], wraplength=700).pack(anchor="w", pady=(0, 20))
        ttk.Button(self.frame, text="Back to home", command=self.build_home_screen).pack(anchor="w")

    def format_module_name(self, module):
        return MODULE_DETAILS[module]["name"] if module in MODULE_DETAILS else module.title()

    def module_description(self, module):
        return MODULE_DETAILS[module]["description"] if module in MODULE_DETAILS else "Module available for your profile"


def main():
    root = tk.Tk()
    style = ttk.Style(root)
    style.theme_use("clam")
    style.configure("TFrame", background="#f4f9ff")
    style.configure("Card.TFrame", background="#ffffff")
    style.configure("TLabel", background="#f4f9ff", foreground="#1d3557")
    style.configure("TButton", background="#2f80ed", foreground="#ffffff")
    style.map("TButton", background=[("active", "#1f6feb")])
    HospitalApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
