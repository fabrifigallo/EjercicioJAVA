package ActJavaFigallo;

import java.util.Scanner;

public class Sistema {
private static Scanner input = new Scanner (System.in);
	public static void main(String[] args) {
		String nombre;
		String apellido;
		int edad;
		String hobbie;
		String editorPref;
		String sistPref;
		
		System.out.println("Ingrese por favor su nombre.");
		nombre = input.nextLine();
		
		System.out.println("Ingrese por favor su apellido.");
		apellido = input.nextLine();
		
		System.out.println("Ingrese por favor su edad.");
		edad = Integer.parseInt(input.nextLine());
		
		System.out.println("Ingrese su hobbie por favor");
		hobbie = input.nextLine();
		
		System.out.println("Ingrese su editor de codigo preferido por favor.");
		editorPref = input.nextLine();
		
		System.out.println("Ingrese su sistema operativo que utiliza por favor.");
		sistPref = input.nextLine();
		
		
		System.out.println("Los datos ingresados son:" + " " + nombre + " " + apellido + " " + edad + " " +  hobbie + " " + editorPref + " " + sistPref);
	
	
		
	
	
	}
	





}
