import 'dart:convert';

import 'package:flutter/material.dart';

class MyDropdownButton extends StatefulWidget {
  String title;
  final List<String?>? list;

  MyDropdownButton({super.key, required this.title, required this.list});

  @override
  State<MyDropdownButton> createState() => _MyDropdownButtonState();
}

class _MyDropdownButtonState extends State<MyDropdownButton> {
  late String dropdownValue;

  @override
  void initState() {
    super.initState();
    dropdownValue = widget.list!.first!;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 25.0, vertical: 5.0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 25.0, vertical: 15.0),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey, width: 1),
          borderRadius: BorderRadius.circular(4)
        ),
        child: DropdownButton<String>(
          elevation: 16,
          hint: Text(widget.title),
          icon: const Icon(Icons.keyboard_arrow_down),
          isExpanded: true,
          isDense: true,
          underline: const SizedBox(),
          style: const TextStyle(color: Colors.black),
          onChanged: (String? value) {
            setState(() {
              dropdownValue = value!;
            });
          },
          items: widget.list?.map<DropdownMenuItem<String>>((String? value) {
            return DropdownMenuItem<String>(
              value: value,
              child: Text(value!),
            );
          }).toList(),
        ),
      ),
    );
  }
}